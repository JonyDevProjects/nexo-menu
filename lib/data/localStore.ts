import * as fs from "node:fs";
import * as path from "node:path";
import { FullMenuData } from "../types";

const LOCAL_MENUS_FILE = path.resolve(process.cwd(), "data/local_menus.json");

// In-memory cache for fast SSR lookups
const inMemoryStore = new Map<string, FullMenuData>();

function ensureLoaded() {
  try {
    if (fs.existsSync(LOCAL_MENUS_FILE)) {
      const content = fs.readFileSync(LOCAL_MENUS_FILE, "utf-8");
      if (content.trim()) {
        const parsed: Record<string, FullMenuData> = JSON.parse(content);
        for (const [slug, menu] of Object.entries(parsed)) {
          inMemoryStore.set(slug, menu);
        }
      }
    }
  } catch (err) {
    console.warn("[LocalStore] Advertencia al leer local_menus.json:", err);
  }
}

export function getLocalMenu(slug: string): FullMenuData | null {
  ensureLoaded();
  return inMemoryStore.get(slug) || null;
}

export function saveLocalMenu(menu: FullMenuData): void {
  try {
    ensureLoaded();
    inMemoryStore.set(menu.restaurant.slug, menu);

    const dir = path.dirname(LOCAL_MENUS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const currentData: Record<string, FullMenuData> = {};
    for (const [s, m] of inMemoryStore.entries()) {
      currentData[s] = m;
    }

    fs.writeFileSync(LOCAL_MENUS_FILE, JSON.stringify(currentData, null, 2), "utf-8");
    console.log(`[LocalStore] Carta guardada exitosamente en disco para slug: '${menu.restaurant.slug}' (${menu.categories.reduce((acc, c) => acc + c.dishes.length, 0)} platos).`);
  } catch (err) {
    console.error("[LocalStore] Error al persistir local_menus.json:", err);
  }
}
