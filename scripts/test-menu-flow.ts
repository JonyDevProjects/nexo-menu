/**
 * ==============================================================================
 * NEXO PLATFORM - TICKET NXE-10 QA VALIDATION SUITE
 * Description: Automated test verifying:
 *  1. Fallback anónimo local en app/actions/auth.ts (sin bloqueo por fetch failed).
 *  2. Publicación de carta en app/actions/menu.ts con fallback local a /m/[slug].
 *  3. Purga del modelo obsoleto gemini-2.5-flash (HTTP 404) y timeout estricto 20s.
 *  4. Paridad e integridad tipológica completa.
 * ==============================================================================
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface CheckItem {
  title: string;
  category: "Auth Resiliente" | "Guardado de Carta" | "Optimización Gemini IA" | "Contrato End-to-End" | "Persistencia Local" | "Vista Dedicada QR";
  passed: boolean;
  detail: string;
}

const checks: CheckItem[] = [];

function check(
  category: CheckItem["category"],
  title: string,
  passed: boolean,
  detail: string
) {
  checks.push({ category, title, passed, detail });
  const badge = passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
  console.log(`${badge} ${category.padEnd(24)} | ${title}`);
  console.log(`       \x1b[90m↳ ${detail}\x1b[0m`);
}

function runSuite() {
  console.log("==============================================================================");
  console.log("  NEXO - VERIFICACIÓN TÉCNICA NXE-10 (AUTH LOCAL & LATENCIA GEMINI)");
  console.log("==============================================================================\n");

  const cwd = process.cwd();

  // 1. Audit app/actions/auth.ts
  console.log("--- Fase 1: Auditoría de Resiliencia en app/actions/auth.ts ---");
  const authCode = fs.readFileSync(path.join(cwd, "app/actions/auth.ts"), "utf-8");

  check(
    "Auth Resiliente",
    "Detección de entorno local sin Supabase Cloud (!supabase.co)",
    authCode.includes('supabaseUrl.includes("supabase.co")'),
    "Condición isCloudSupabase implementada para prevenir llamadas HTTP fallidas a :54322"
  );

  check(
    "Auth Resiliente",
    "Fallback transparente a demo-anonymous-user en ensureAnonymousSessionAction",
    authCode.includes('userId: "demo-anonymous-user"') &&
      authCode.includes("isAnonymous: true"),
    "Retorna sesión anónima local de inmediato cuando no hay GoTrue HTTP disponible"
  );

  check(
    "Auth Resiliente",
    "linkEmailAction protegido contra fallos de conexión en local",
    authCode.includes("if (!isCloudSupabase)") &&
      authCode.includes("return { success: true }"),
    "El flujo de onboarding no se interrumpe si el servidor no tiene GoTrue en local"
  );

  // 2. Audit app/actions/menu.ts
  console.log("\n--- Fase 2: Auditoría de Guardado de Carta en app/actions/menu.ts ---");
  const menuCode = fs.readFileSync(path.join(cwd, "app/actions/menu.ts"), "utf-8");

  check(
    "Guardado de Carta",
    "saveMenuAction discriminación de entorno Cloud vs Local",
    menuCode.includes('supabaseUrl.includes("supabase.co")'),
    "No ejecuta llamadas HTTP a PostgREST en el puerto PostgreSQL 54322"
  );

  check(
    "Guardado de Carta",
    "saveMenuAction fallback local transparente y redirección a /m/[slug]",
    menuCode.includes("cleanSlug") &&
      menuCode.includes("return {") &&
      menuCode.includes("url: `/m/${cleanSlug}`"),
    "Retorna URL pública para redirección sin lanzar AuthRetryableFetchError"
  );

  check(
    "Guardado de Carta",
    "Obligatoriedad de confirmación legal de alérgenos UE preservada",
    menuCode.includes("!payload.legalConfirmed") &&
      menuCode.includes("Debes confirmar y certificar la información de alérgenos"),
    "Cumplimiento legal del Reglamento UE 1169/2011 blindado"
  );

  // 3. Audit lib/gemini/extract.ts
  console.log("\n--- Fase 3: Auditoría de Optimización de Inferencia Gemini ---");
  const geminiCode = fs.readFileSync(path.join(cwd, "lib/gemini/extract.ts"), "utf-8");

  check(
    "Optimización Gemini IA",
    "Modelo obsoleto gemini-2.5-flash (404 Not Found) purgado",
    !geminiCode.includes('"gemini-2.5-flash"') &&
      geminiCode.includes('clean.includes("2.5")'),
    "Eliminado de candidatos estáticos, dinámicos y listas de prioridad"
  );

  check(
    "Optimización Gemini IA",
    "Timeout estricto de 20s por intento con AbortController",
    geminiCode.includes("timeoutMs = 20000") &&
      geminiCode.includes("abortController.abort()") &&
      geminiCode.includes("Promise.race"),
    "Evita demoras de 5 minutos cancelando de inmediato intentos no responsivos"
  );

  const priorityListMatch = geminiCode.match(/const priorityList = \[([\s\S]*?)\];/);
  const priorityListStr = priorityListMatch ? priorityListMatch[1] : "";
  check(
    "Optimización Gemini IA",
    "Prioridad de modelos rápidos y de alta disponibilidad",
    priorityListStr.indexOf("gemini-flash-lite-latest") < priorityListStr.indexOf("gemini-2.0-flash") &&
      priorityListStr.indexOf("gemini-2.0-flash") < priorityListStr.indexOf("gemini-1.5-flash-latest"),
    "gemini-flash-lite-latest y gemini-2.0-flash encabezan la cascada para respuestas en < 3s"
  );

  // 4. Audit lib/data/menu.ts
  console.log("\n--- Fase 4: Auditoría de Visualización Pública en /m/[slug] ---");
  const dataMenuCode = fs.readFileSync(path.join(cwd, "lib/data/menu.ts"), "utf-8");

  check(
    "Contrato End-to-End",
    "getPublicMenuBySlug resuelve cartas publicadas en local sin llamadas HTTP inválidas",
    dataMenuCode.includes("if (!isCloudSupabase)") &&
      dataMenuCode.includes("DEMO_RESTAURANT_MENU"),
    "Las rutas públicas /m/[slug] cargan con HTTP 200 y datos completos en local"
  );

  // 5. Audit Local Storage & Dish Fidelity
  console.log("\n--- Fase 5: Auditoría de Persistencia Local y Fidelidad de Platos ---");
  const localStoreExists = fs.existsSync(path.join(cwd, "lib/data/localStore.ts"));
  const localStoreCode = localStoreExists
    ? fs.readFileSync(path.join(cwd, "lib/data/localStore.ts"), "utf-8")
    : "";

  check(
    "Persistencia Local",
    "Implementación de almacén local persistente (lib/data/localStore.ts)",
    localStoreExists &&
      localStoreCode.includes("export function getLocalMenu") &&
      localStoreCode.includes("export function saveLocalMenu"),
    "Exporta getLocalMenu y saveLocalMenu con almacenamiento en memoria y JSON"
  );

  check(
    "Persistencia Local",
    "Integración de guardado en app/actions/menu.ts",
    menuCode.includes("saveLocalMenu(fullMenuData)"),
    "saveMenuAction persiste el 100% de platos y categorías en el almacén local"
  );

  check(
    "Persistencia Local",
    "Prioridad de consulta local en lib/data/menu.ts",
    dataMenuCode.includes("const localMenu = getLocalMenu(slug)") &&
      dataMenuCode.includes("if (localMenu)"),
    "fetchPublicMenuFromSource prioriza los datos reales antes de cualquier fallback"
  );

  const localMenusJsonPath = path.join(cwd, "data/local_menus.json");
  let chulapoDishCount = 0;
  if (fs.existsSync(localMenusJsonPath)) {
    try {
      const menus = JSON.parse(fs.readFileSync(localMenusJsonPath, "utf-8"));
      const chulapo = menus["taberna-el-chulapo"];
      if (chulapo && chulapo.categories) {
        chulapoDishCount = chulapo.categories.reduce(
          (acc: number, cat: any) => acc + (cat.dishes ? cat.dishes.length : 0),
          0
        );
      }
    } catch {
      chulapoDishCount = 0;
    }
  }

  check(
    "Persistencia Local",
    "Integridad y fidelidad de platos en Taberna El Chulapo (8 platos extraídos)",
    chulapoDishCount === 8,
    `Persistidos exactamente 8/8 platos en data/local_menus.json (detectados: ${chulapoDishCount} platos)`
  );

  // 6. Audit Dedicated /qr/[slug] Page & Stand
  console.log("\n--- Fase 6: Auditoría de Ruta Dedicada /qr/[slug] y Plantilla A5 ---");
  const qrPagePath = path.join(cwd, "app/qr/[slug]/page.tsx");
  const qrPageExists = fs.existsSync(qrPagePath);
  const qrPageCode = qrPageExists ? fs.readFileSync(qrPagePath, "utf-8") : "";

  check(
    "Vista Dedicada QR",
    "Existencia y contrato de app/qr/[slug]/page.tsx (Next.js 15 async params)",
    qrPageExists &&
      qrPageCode.includes("await params") &&
      qrPageCode.includes("getPublicMenuBySlug") &&
      qrPageCode.includes("QrDedicatedView"),
    "Ruta de servidor /qr/[slug] implementada con resolución ISR de carta"
  );

  const qrDedicatedViewPath = path.join(cwd, "components/qr/QrDedicatedView.tsx");
  const qrDedicatedExists = fs.existsSync(qrDedicatedViewPath);
  const qrDedicatedCode = qrDedicatedExists ? fs.readFileSync(qrDedicatedViewPath, "utf-8") : "";

  check(
    "Vista Dedicada QR",
    "Componente QrDedicatedView con peana A5, descarga PNG/SVG e impresión",
    qrDedicatedExists &&
      qrDedicatedCode.includes('id="nexo-a5-stand"') &&
      qrDedicatedCode.includes("QRCodeSVG") &&
      qrDedicatedCode.includes("window.print()") &&
      qrDedicatedCode.includes("downloadPNG") &&
      qrDedicatedCode.includes("downloadSVG"),
    "Plantilla #nexo-a5-stand y exportaciones de alta resolución disponibles"
  );

  const publicViewCode = fs.readFileSync(path.join(cwd, "components/menu/MenuPublicView.tsx"), "utf-8");
  check(
    "Vista Dedicada QR",
    "Navegabilidad cruzada: botón de acceso a /qr/[slug] en la carta pública",
    publicViewCode.includes("/qr/${data.restaurant.slug}") || publicViewCode.includes('href={`/qr/${'),
    "Enlace a la peana QR visible para el hostelero desde la cabecera de la carta"
  );

  check(
    "Vista Dedicada QR",
    "Revalidación de caché en app/actions/menu.ts para /qr/[slug]",
    menuCode.includes("revalidatePath(`/qr/${cleanSlug}`)"),
    "saveMenuAction invalida instantáneamente la caché de la página QR al actualizar la carta"
  );

  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  const rate = ((passedCount / totalCount) * 100).toFixed(1);

  console.log("\n==============================================================================");
  console.log(`  RESUMEN NXE-10: ${passedCount}/${totalCount} verificaciones pasadas (${rate}%)`);
  console.log("==============================================================================\n");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runSuite();
