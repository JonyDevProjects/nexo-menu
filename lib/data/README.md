# `lib/data/` — Persistence & Fetch Layer

## Purpose

Responsible for loading, caching, and serving `FullMenuData` (restaurant metadata + categorized dishes). Provides both a **file-backed local store** and a **cached public-fetch resolver** that combines local storage with Supabase as the remote source of truth.

---

## Modules

### `localStore.ts` — File-Backed In-Memory Cache

```ts
/**
 * Reads data/local_menus.json into an in-memory Map.
 * Subsequent calls reuse the loaded map (single-load pattern).
 */
function getLocalMenu(slug: string): FullMenuData | null
```

```ts
/**
 * Writes a FullMenuData object into the in-memory store and persists
 * the entire registry to data/local_menus.json via fs.writeFileSync.
 */
function saveLocalMenu(menu: FullMenuData): void
```

**File location**: `{cwd}/data/local_menus.json` (resolved via `path.resolve(process.cwd(), "data/local_menus.json")`).

**Loading strategy**: Lazy on first `getLocalMenu` call (`ensureLoaded` idiom). Once loaded, the in-memory `Map<string, FullMenuData>` serves all subsequent reads synchronously.

**Save strategy**: Always re-reads from memory, serializes the complete map, and atomically writes the file. Does NOT merge — full replacement of the JSON file contents.

---

### `menu.ts` — Cached Public Menu Resolver

```ts
const DEMO_RESTAURANT_MENU: FullMenuData
// Static fallback data for Bar Pepe & Tapas. Used when:
//   - Slug is "bar-pepe", "demo", or "mibar" AND no cloud Supabase is configured.
//   - All upstream sources fail.
```

```ts
/**
 * Resolves a public menu by restaurant slug with Next.js unstable_cache.
 * Cache key: ["public-menu", slug]. Revalidates every 60 seconds.
 * Invalidation tag: `menu-{slug}` (call revalidateTag(tag) for immediate bust).
 */
async function getPublicMenuBySlug(slug: string): Promise<FullMenuData | null>
```

**Fetch strategy (inside `fetchPublicMenuFromSource`)**:

```
1. Check localStore.getLocalMenu(slug)   → if found, return
2. Is NEXT_PUBLIC_SUPABASE_URL containing ".supabase.co"?
   NO  → return DEMO_RESTAURANT_MENU (for dev) or null (for unknown slugs)
   YES → query Supabase:
         a) SELECT * FROM restaurants WHERE slug = ? AND is_published = true
         b) SELECT * FROM categories JOIN dishes WHERE restaurant_id = ? ORDER BY order_index
         → assemble FullMenuData or fall back to DEMO_RESTAURANT_MENU
```

---

## Dependencies

```
localStore.ts  → node:fs, node:path, types.ts
menu.ts        → next/cache (unstable_cache),
                 supabase/public.ts,
                 types.ts,
                 localStore.ts
```

---

## Invariants & Side Effects

| Aspect | Detail |
|---|---|
| **Cache consistency** | `unstable_cache` wraps the internal async function. The outer function just delegates. Consecutive calls with the same slug within 60 s return the cached result identically. |
| **Invalidation** | External code should call `revalidateTag(\`menu-${slug}\`)` (via Next.js `next/revalidate`) to invalidate the cache eagerly. Not doing so means stale data up to 60 s. |
| **Disk mutation** | `saveLocalMenu` performs a blocking `fs.writeFileSync`. In high-concurrency scenarios this could overwrite concurrent saves. Intended for admin/dashboard writes, not hot paths. |
| **Fallback behavior** | All failure modes (Supabase error, network outage, missing slug) gracefully degrade to either `DEMO_RESTAURANT_MENU` or `null`. Never throws from the public-facing resolver. |
| **Demo trigger** | Demo mode activates when `NEXT_PUBLIC_SUPABASE_URL` is absent, falsy, or does not include `.supabase.co`. This guards against accidental production calls during local development with dummy keys. |
| **Deterministic ordering** | Categories returned from Supabase are ordered by `order_index ASC`. Dishes within categories retain their stored `order_index`. |

---

## Contract Summary

```
Caller → getPublicMenuBySlug(slug)
  ↓
  fetchPublicMenuFromSource(slug) [uncached core logic]
    ├→ getLocalMenu(slug)         → FullMenuData \| null
    ├→ Supabase (if configured)   → FullMenuData \| null
    └→ DEMO_RESTAURANT_MENU       → FullMenuData  (final fallback)
  ↑
unstable_cache wraps above, revalidate=60s, tag=menu-{slug}
```

The contract: callers receive either a fully-typed `FullMenuData` with populated categories and dishes, or `null` (only for genuinely non-existent published restaurants in production). The consumer never sees errors, retries, or fallback chains exposed.
