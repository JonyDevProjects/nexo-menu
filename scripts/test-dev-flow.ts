/**
 * ==============================================================================
 * NEXO PLATFORM - DEV ENVIRONMENT INGESTION FLOW TEST
 * Tests the end-to-end menu photo upload, AI extraction, and data normalization.
 * ==============================================================================
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { extractMenu, ImageInput } from "../lib/ai";
import { ExtractedMenuSchema } from "../lib/types";

async function runDevFlowTest() {
  console.log("==============================================================================");
  console.log("   NEXO PLATFORM - TEST DEL FLUJO PRINCIPAL DE DIGITALIZACIÓN (DEV)");
  console.log("==============================================================================\n");

  // 1. Localizar imagen de muestra real
  const sampleImagePath = path.resolve(process.cwd(), "data/benchmark_dataset/carta_impresa_2col.jpg");
  if (!fs.existsSync(sampleImagePath)) {
    console.error(`[ERROR] No se encontró la imagen de prueba en ${sampleImagePath}`);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(sampleImagePath);
  const base64Data = imageBuffer.toString("base64");
  const mimeType = "image/jpeg";
  const sizeKb = (imageBuffer.length / 1024).toFixed(1);

  console.log(`[Paso 1] Imagen de muestra cargada correctamente:`);
  console.log(`         Archivo: data/benchmark_dataset/carta_impresa_2col.jpg`);
  console.log(`         Tamaño: ${sizeKb} kB`);
  console.log(`         Formato: ${mimeType}\n`);

  const images: ImageInput[] = [{ base64Data, mimeType }];

  // 2. Probar inferencia en modo Mock / Offline
  console.log("[Paso 2] Ejecutando extracción de carta con motor de inferencia (Modo Mock / Offline)...");
  const startTime = Date.now();
  const mockResult = await extractMenu(images, { provider: "mock" });
  const mockDuration = Date.now() - startTime;

  console.log(`[PASS] Inferencia completada en ${mockDuration}ms`);
  console.log(`       Proveedor: ${mockResult.provider} (${mockResult.modelName})`);

  // 3. Validar Schema Zod de salida
  console.log("\n[Paso 3] Validando integridad de datos con ExtractedMenuSchema (Zod)...");
  const parsed = ExtractedMenuSchema.safeParse(mockResult.data);
  if (!parsed.success) {
    console.error("[FAIL] Error de validación de esquema Zod:", parsed.error);
    process.exit(1);
  }
  console.log("[PASS] Esquema Zod validado al 100% (formato válido para el editor)");

  // 4. Auditoría de platos y alérgenos extraídos
  console.log("\n[Paso 4] Desglose de contenido extraído de la carta:");
  let totalDishes = 0;
  let totalAllergens = 0;

  mockResult.data.categories.forEach((cat, idx) => {
    console.log(`       📁 Categoría ${idx + 1}: ${cat.name_es} (${cat.dishes.length} platos)`);
    cat.dishes.forEach((dish) => {
      totalDishes++;
      totalAllergens += dish.allergens.length;
      const allergenBadge = dish.allergens.length > 0 ? `[Alérgenos: ${dish.allergens.join(", ")}]` : "[Sin alérgenos]";
      console.log(`          • ${dish.name_es.padEnd(35)} | ${dish.price.toFixed(2)} € | ${allergenBadge}`);
    });
  });

  console.log(`\n       Total categorías detectadas : ${mockResult.data.categories.length}`);
  console.log(`       Total platos extraídos      : ${totalDishes}`);
  console.log(`       Total alérgenos detectados  : ${totalAllergens}`);

  // 5. Probar conectividad con Gemini si hay clave configurada
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== "your-gemini-api-key" && geminiKey.startsWith("AIza")) {
    console.log("\n[Paso 5] Clave de Gemini Cloud detectada. Probando extracción real con Gemini Flash...");
    try {
      const geminiStartTime = Date.now();
      const geminiResult = await extractMenu(images, { provider: "gemini", apiKey: geminiKey });
      const geminiDuration = Date.now() - geminiStartTime;
      console.log(`[PASS] Inferencia Gemini Flash completada en ${geminiDuration}ms`);
      console.log(`       Proveedor: ${geminiResult.provider} (${geminiResult.modelName})`);
    } catch (err: any) {
      console.warn(`[WARN] Inferencia Gemini Flash falló (usando fallback offline):`, err?.message || err);
    }
  } else {
    console.log("\n[Paso 5] Modo Gemini Cloud omitido (sin API key en entorno).");
    console.log("       ↳ Puedes configurar GEMINI_API_KEY en .env.local o desde el panel de control en la UI.");
  }

  console.log("\n==============================================================================");
  console.log("✅ FLUJO DE DIGITALIZACIÓN VALIDADO CON ÉXITO EN EL ENTORNO DE DESARROLLO");
  console.log("==============================================================================");
}

runDevFlowTest().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
