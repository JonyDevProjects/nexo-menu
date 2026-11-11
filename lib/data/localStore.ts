import * as fs from "node:fs";
import * as path from "node:path";
import { FullMenuData } from "../types";

const LOCAL_MENUS_FILE = path.resolve(process.cwd(), "data/local_menus.json");
const VERSION_FILE = path.resolve(process.cwd(), "data/.local_menus_version.json");

// In-memory cache for fast SSR lookups
const inMemoryStore = new Map<string, FullMenuData>();

// ── Cache freshness tracking ────────────────────────────────────────────────
// Stores a monotonically-increasing version counter so callers can detect
// whether their cached snapshot is still fresh after a background save.
interface VersionFile {
  /** Monotonically increasing version number (starts at 0). */
  v: number;
  /** Timestamp in ms of the last successful persistence. */
  ts: number;
}

let currentVersion = 0;
let expectedTimestamp = 0;

/**
 * Loads the version file (if it exists) to restore our position in the
 * version sequence. Does NOT throw — a missing version file simply means
 * we start from zero.
 */
function loadVersion(): void {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const raw = fs.readFileSync(VERSION_FILE, "utf-8");
      if (raw.trim()) {
        const ver: VersionFile = JSON.parse(raw);
        if (typeof ver.v === "number" && Number.isFinite(ver.v)) {
          currentVersion = ver.v;
          expectedTimestamp = ver.ts || Date.now();
        }
      }
    }
  } catch {
    // Version file is cosmetic; proceed without it.
  }
}

/** Persists the current version atomically (temp + rename). */
function persistVersion(): void {
  currentVersion++;
  expectedTimestamp = Date.now();
  writeJsonAtomically(VERSION_FILE, { v: currentVersion, ts: expectedTimestamp });
}

/** @returns The latest version number (callers may use this to detect staleness). */
export function getVersion(): number {
  return currentVersion;
}

// ── Write-pending promise queue (coalescing) ────────────────────────────────
// When multiple saves happen in rapid succession, we await any in-flight
// write so we don't do redundant reload → serialise writes, but coalesce
// in-memory updates eagerly so the final payload has every update.

let writePromise: Promise<void> | null = null;

/** Internal queue gate – returns the pending write promise (null when idle). */
function getWritePromise(): Promise<void> | null {
  return writePromise;
}

/** Sets / clears the in-flight write promise. Pass `null` to clear the gate. */
function setWritePromise(p: Promise<void> | null): void {
  writePromise = p;
}

// ── Read-only filesystem detection ───────────────────────────────────────
// In serverless / container runtimes (Vercel, Docker) the task directory is
// read-only. We probe once on first write attempt and remember the result so
// subsequent calls skip the disk path immediately.
let writableDiskCacheFlag: "writable" | "readonly" | null = null;

function isDiskWritable(): boolean {
  if (writableDiskCacheFlag !== null) {
    return writableDiskCacheFlag === "writable";
  }
  try {
    const testFile = `${process.cwd()}/data/.local_write_test`;
    fs.writeFileSync(testFile, "ok", "utf-8");
    fs.unlinkSync(testFile);
    writableDiskCacheFlag = "writable";
    return true;
  } catch {
    writableDiskCacheFlag = "readonly";
    return false;
  }
}

// ── Atomic JSON writer (temp file + verify + rename) ────────────────────────
/**
 * Writes JSON content to *filePath* using an atomic temp-file-then-rename
 * pattern. On POSIX systems `rename()` is instantaneous and atomic, so
 * readers never see a partial write.
 *
 * After writing, the file is re-read and parsed to verify integrity; if
 * verification fails the error is thrown.
 *
 * @param filePath       Destination absolute path.
 * @param data           Value to serialize.
 * @param prettyPrint    If `true`, indent output with 2 spaces.
 */
function writeJsonAtomically<T>(
  filePath: string,
  data: T,
  prettyPrint = true
): void {
  // Ensure parent directory exists (only needed once; mkdirSync with
  // recursive:true is safe even if the dir exists).
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const serialized = JSON.stringify(data, null, prettyPrint ? 2 : 0);
  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;

  // 1. Write to temporary file.
  fs.writeFileSync(tmpPath, serialized, "utf-8");

  // 2. Verify by re-reading & parsing (no cleanup needed — rename will handle tmpPath).
  let verified: T;
  try {
    const verifiedRaw = fs.readFileSync(tmpPath, "utf-8");
    verified = JSON.parse(verifiedRaw);
  } catch {
    throw new Error(
      `[LocalStore] Verification failed reading ${tmpPath} after successful write.`
    );
  }

  // Compare the round-trip with the original value so a silent data-loss
  // scenario would surface immediately.
  if (JSON.stringify(verified) !== JSON.stringify(data)) {
    throw new Error(
      `[LocalStore] Integrity check failed after writing ${filePath}: write/verify mismatch.`
    );
  }

  // 3. Atomic rename into the target location.
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    throw new Error(
      `[LocalStore] Failed to rename temp file to ${filePath}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

// ── Sync reader helpers ─────────────────────────────────────────────────────

interface MenuIndex {
  [slug: string]: FullMenuData;
}

/**
 * Reads and parses the local menus file.  **No existence check** — we rely
 * on try/catch around `readFileSync`, which eliminates the TOCTOU race
 * window between `existsSync` and the subsequent read.
 *
 * @throws `{Error}` When the file cannot be read or does not contain valid JSON.
 */
function parseMenusFile(): MenuIndex {
  try {
    const content = fs.readFileSync(LOCAL_MENUS_FILE, "utf-8");
    if (!content.trim()) return {}; // empty file → treat as no data.
    return JSON.parse(content);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "ENOENT") {
      // File doesn't exist yet — perfectly normal on first run.
      return {};
    }
    throw new Error(
      `[LocalStore] Failed to read ${LOCAL_MENUS_FILE}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Populates `inMemoryStore` from disk.  Re-throws on failure so callers
 * (or a UI layer) can react (toast, log, retry).
 *
 * @throws `{Error}` When the file exists but is unreadable / invalid JSON.
 */
export function ensureLoaded(): void {
  loadVersion();
  const index = parseMenusFile();
  for (const [slug, menu] of Object.entries(index)) {
    inMemoryStore.set(slug, menu);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieves a stored menu by its restaurant slug.
 * Calls `ensureLoaded()` lazily on the first access.
 *
 * @param slug  Restaurant slug key.
 * @returns The `FullMenuData` object, or `null` if not found.
 */
export function getLocalMenu(slug: string): FullMenuData | null {
  ensureLoaded();
  return inMemoryStore.get(slug) || null;
}

/**
 * Saves a menu to disk.  Internally uses a **write-coalescing queue**: if
 * another save is already in progress, the caller awaits that write rather
 * than triggering a duplicate cycle.
 *
 * This operation is now **asynchronous** (`Promise<void>`) because the
 * underlying atomic write + verification flow requires async I/O in the
 * future-proof design. A synchronous wrapper is exposed if strictly
 * required, but callers should prefer the async form.
 *
 * @param menu  The complete menu object to persist.
 * @throws `{Error}` When the write or verification step fails.
 */
export async function saveLocalMenu(menu: FullMenuData): Promise<void> {
  const slug = menu.restaurant.slug;

  // Eagerly update in-memory cache so subsequent reads are immediate,
  // even while the disk write is in flight.
  ensureLoaded();
  inMemoryStore.set(slug, menu);

  // Skip disk write in read-only environments (Vercel serverless, Docker).
  // In-memory data persists for the lifetime of the process/edge function.
  if (!isDiskWritable()) {
    console.warn(
      `[LocalStore] Disk is read-only (serverless/container). Menu '${slug}' saved in memory only.`
    );
    return;
  }

  // If a write is already in progress, coalesce into that one and return
  // the existing promise — avoids N+1 reload/write cycles.
  const existing = getWritePromise();
  if (existing) {
    return existing;
  }

  const writeTask = (async (): Promise<void> => {
    try {
      // Re-read disk to get the freshest base state before building the payload.
      const currentIndex = parseMenusFile();
      currentIndex[slug] = menu;

      // Write the full index atomically.
      writeJsonAtomically(LOCAL_MENUS_FILE, currentIndex);

      // Bump the version stamp so consumers can detect staleness.
      persistVersion();

      console.log(
        `[LocalStore] Carta guardada exitosamente en disco para slug: '${slug}' (${menu.categories.reduce((acc, c) => acc + c.dishes.length, 0)} platos).`
      );
    } catch (err: unknown) {
      throw new Error(
        `[LocalStore] Error al persistir local_menus.json: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      // Clear the queue sentinel so future calls aren't blocked forever.
      setWritePromise(null);
    }
  })();

  setWritePromise(writeTask);
  return writeTask.catch((e) => {
    // Re-throw after clearing — prevents callers from awaiting a dead promise.
    setWritePromise(null);
    throw e;
  });
}

/**
 * Synchronous wrapper around `saveLocalMenu`.  Useful in contexts where an
 * async call isn't possible (e.g., event emitters that don't support promises).
 * Under the hood it blocks on the atomic write.
 *
 * ⚠️  Warning: blocking the event loop on disk I/O is discouraged in Node.js
 *     and Next.js server components. Prefer the async `saveLocalMenu` variant.
 *
 * @param menu  The complete menu object to persist.
 * @throws `{Error}` When the write or verification step fails.
 */
export function saveLocalMenuSync(menu: FullMenuData): void {
  ensureLoaded();
  inMemoryStore.set(menu.restaurant.slug, menu);

  // Skip disk write in read-only environments (Vercel serverless, Docker).
  if (!isDiskWritable()) {
    console.warn(
      `[LocalStore] Disk is read-only (serverless/container). Menu '${menu.restaurant.slug}' saved in memory only.`
    );
    return;
  }

  const currentIndex: MenuIndex = {};
  for (const [s, m] of inMemoryStore.entries()) {
    currentIndex[s] = m;
  }

  writeJsonAtomically(LOCAL_MENUS_FILE, currentIndex);
  persistVersion();
}
