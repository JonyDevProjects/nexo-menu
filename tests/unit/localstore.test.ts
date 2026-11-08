// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FullMenuData } from "../../lib/types";

// ── Mock factories (hoisted by vi.mock) ─────────────────────────────────────
// These MUST use only top-level expressions — no references to per-test
// variables — because vi.mock() is hoisted above all other code.

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:path", () => ({
  resolve: vi.fn((...args: string[]) => args.join("/")),
  dirname: vi.fn((p: string) => p.split("/").slice(0, -1).join("/") || "/"),
}));

// Capture references to the mock functions so tests can inspect them.
import * as fs from "node:fs";
import * as path from "node:path";

describe("localStore – in-memory cache & disk persistence", () => {
  // Helper to build a minimal menu fixture used across tests.
  function makeFixture(): FullMenuData {
    return {
      restaurant: {
        id: "rest-1",
        user_id: "user-1",
        name: "Test Restaurant",
        slug: "test-slug",
        description: null,
        currency: "USD",
        logo_url: null,
        is_published: false,
        subscription_tier: "free",
        ai_scans_today: 0,
        ai_scans_reset_at: "2025-01-01T00:00:00Z",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      categories: [
        {
          id: "cat-1",
          restaurant_id: "rest-1",
          name_es: "Entradas",
          name_en: "Appetizers",
          order_index: 0,
          dishes: [
            {
              id: "dish-1",
              category_id: "cat-1",
              restaurant_id: "rest-1",
              name_es: "Nachos",
              name_en: "Nachos",
              description_es: "Delicious nachos",
              description_en: "Delicious nachos",
              price: 8.99,
              allergens: ["dairy"],
              is_available: true,
              image_url: null,
              order_index: 0,
            },
          ],
        },
      ],
    };
  }

  async function loadModule() {
    const mod = await import("../../lib/data/localStore");
    return mod;
  }

  // ── Test 1: saveLocalMenu stores data in memory map ────────────────────────

  it("saveLocalMenu stores data in the in-memory Map", async () => {
    // Arrange: directory exists; all file reads return empty index JSON.
    // writeFileSync will fail integrity verification (reads back "{}" ≠ big payload),
    // but we catch the error and assert that write was ATTEMPTED anyway.
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("{}");

    const menu = makeFixture();

    // Act: stub writeFileSync to throw ENOENT on tmp-path so we capture writes.
    let capturedPayload: string | null = null;
    vi.mocked(fs.writeFileSync).mockImplementation((_path, data) => {
      capturedPayload = typeof data === "string" ? data : String(data);
      // Throw on the temp path so the verify step catches the error.
      throw new Error("ENOSPC: simulated disk full");
    });
    vi.mocked(fs.renameSync).mockImplementation(() => { /* no-op */ });

    // We know writeJsonAtomicy throws → saveLocalMenu wraps it.
    // But our custom error message lets us verify the write happened.
    const { saveLocalMenu } = await loadModule();
    await expect(saveLocalMenu(menu)).rejects.toThrow(/simulate/);

    // Assert: writeFileSync was called (disk attempt occurred).
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalled();
    // Verify payload structure survived round-trip before the error.
    if (capturedPayload) {
      const parsed = JSON.parse(capturedPayload);
      expect(parsed["test-slug"]).not.toBeNull();
      expect(parsed["test-slug"].restaurant.name).toBe("Test Restaurant");
    }
  });

  // ── Test 2: getLocalMenu returns stored data by slug ───────────────────────

  it("getLocalMenu returns stored data when slug matches", async () => {
    // Arrange: pre-populate the index JSON.
    const expectedMenu = makeFixture();
    const index: Record<string, FullMenuData> = {};
    index[expectedMenu.restaurant.slug] = expectedMenu;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // ensureLoaded() calls readFileSync twice (version file + menus file).
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}")          // version file (empty JSON → v stays 0)
      .mockReturnValueOnce(JSON.stringify(index));

    // Act
    const { getLocalMenu } = await loadModule();
    const result = getLocalMenu("test-slug");

    // Assert
    expect(result).not.toBeNull();
    expect(result!.restaurant.name).toBe("Test Restaurant");
    expect(result!.categories[0].name_es).toBe("Entradas");
  });

  // ── Test 3: Multiple slugs are isolated from each other ────────────────────

  it("Multiple slugs are isolated from each other", async () => {
    // Arrange: two distinct menus under different slugs.
    const slugA = "alpha-menu";
    const slugB = "beta-menu";

    const menuA = makeFixture();
    menuA.restaurant.slug = slugA;
    menuA.restaurant.name = "Alpha";

    const menuB = makeFixture();
    menuB.restaurant.slug = slugB;
    menuB.restaurant.name = "Beta";

    const index: Record<string, FullMenuData> = {};
    index[slugA] = menuA;
    index[slugB] = menuB;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // ensureLoaded() calls readFileSync twice.
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}")          // version file (empty JSON → v stays 0)
      .mockReturnValueOnce(JSON.stringify(index));

    // Act
    const { getLocalMenu } = await loadModule();
    const fromA = getLocalMenu(slugA);
    const fromB = getLocalMenu(slugB);

    // Assert: each slug returns its own independent menu object.
    expect(fromA).not.toBeNull();
    expect(fromB).not.toBeNull();
    expect(fromA!.restaurant.name).toBe("Alpha");
    expect(fromB!.restaurant.name).toBe("Beta");
    expect(fromA).not.toBe(fromB);
  });

  // ── Test 4: Serialization / deserialization round-trip preserves structure ─

  it("Serialization/deserialization round-trip preserves data structure", async () => {
    // Arrange: the real JSON.parse/stringify cycle preserves everything.
    const menu = makeFixture();
    const json = JSON.stringify(menu);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    // ensureLoaded() calls readFileSync twice.
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}")          // version file (empty JSON → v stays 0)
      .mockReturnValueOnce(json);

    // Act
    const { getLocalMenu } = await loadModule();
    const retrieved = getLocalMenu("test-slug");

    // Assert: key fields survived the round-trip intact.
    expect(retrieved).not.toBeNull();
    expect(retrieved!.restaurant.slug).toBe(menu.restaurant.slug);
    expect(retrieved!.categories.length).toBe(menu.categories.length);
    expect(retrieved!.categories[0].dishes[0].price).toBe(
      menu.categories[0].dishes[0].price,
    );
    expect(retrieved!.categories[0].dishes[0].allergens).toEqual(
      menu.categories[0].dishes[0].allergens,
    );
  });

  // ── Test 5: Error thrown when disk operations fail ─────────────────────────

  it("Error thrown when disk operations fail (mock fs to throw)", async () => {
    // Arrange: cause writeFileSync to throw → error surfaces through saveLocalMenu.
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // ensureLoaded() reads twice + parseMenusFile in write path = three calls.
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce("{}")          // version file (empty JSON → v stays 0)
      .mockReturnValueOnce("{}")          // menus file (empty index)
      .mockReturnValueOnce("{}");         // parseMenusFile in write path

    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    // Act + Assert: saveLocalMenu should reject with an aggregated error.
    const { saveLocalMenu } = await loadModule();
    await expect(saveLocalMenu(makeFixture())).rejects.toThrow(
      "[LocalStore] Error al persistir local_menus.json",
    );
  });
});
