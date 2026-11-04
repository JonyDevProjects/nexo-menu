import { ExtractedMenu, ExtractedMenuSchema } from "../types";
import { GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT } from "../gemini/prompt";
import { LiteRTImageInput, extractMenuWithLiteRT } from "./litert";

export interface LiteRTHybridOptions {
  visionUrl?: string; // e.g. http://127.0.0.1:11436 (MiniCPM-V 4.7-1B)
  visionModel?: string;
  reasoningUrl?: string; // e.g. http://127.0.0.1:11435 (Gemma 4 26B A4B)
  reasoningModel?: string;
}

/**
 * Pipeline Híbrido LiteRT en 2 Fases:
 * 1. MiniCPM-V 4.7-1B: Extrae texto visual, platos y precios (OCR tabular rápido).
 * 2. Gemma 4 26B A4B: Razona sobre ingredientes, deduce los 14 alérgenos UE, traduce a inglés y emite JSON estricto.
 */
export async function extractMenuWithLiteRTHybrid(
  images: LiteRTImageInput[],
  options?: LiteRTHybridOptions
): Promise<ExtractedMenu> {
  const visionUrl = options?.visionUrl || process.env.LITERT_VISION_URL || "http://127.0.0.1:11436";
  const visionModel = options?.visionModel || process.env.LITERT_VISION_MODEL || "minicpm-v4.7-1b";
  const reasoningUrl = options?.reasoningUrl || process.env.LITERT_REASONING_URL || "http://127.0.0.1:11435";
  const reasoningModel = options?.reasoningModel || process.env.LITERT_REASONING_MODEL || "gemma4-26b";

  console.log(`[LiteRT Hybrid] Paso 1: Extrayendo texto visual con ${visionModel} en ${visionUrl}...`);

  // Paso 1: MiniCPM-V 4.7 hace OCR y extracción visual sin sobrecargarlo con alérgenos ni JSON estricto
  let rawExtractedText = "";
  try {
    const contentParts: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text: `Eres un asistente experto en digitalización visual y OCR gastronómico.
Analiza exhaustivamente cada área de las imágenes de esta carta de restaurante y transcribe ABSOLUTAMENTE TODOS los platos, bebidas y precios sin omitir ninguno:
- Escanea meticulosamente de arriba a abajo y columna por columna.
- Agrupa por las categorías visibles (Entrantes, Tapas, Raciones, Platos Principales, Postres, Bebidas, etc.).
- Para CADA plato visible transcribe:
  1. Nombre exacto del plato o ración.
  2. Descripción, ingredientes o acompañamientos si están escritos.
  3. Precio en euros (€).
- No resumas, no utilices "...", ni saltes ningún elemento visible en los márgenes o columnas secundarias.`,
      },
    ];

    for (const img of images) {
      const cleanB64 = img.base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      const mime = img.mimeType || "image/jpeg";
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${mime};base64,${cleanB64}`,
        },
      });
    }

    const visionRes = await fetch(`${visionUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: visionModel,
        messages: [{ role: "user", content: contentParts }],
        max_tokens: 3500,
        stream: false,
      }),
    });

    if (!visionRes.ok) {
      throw new Error(`Vision model HTTP error: ${visionRes.status}`);
    }

    const visionData = await visionRes.json();
    rawExtractedText = visionData?.choices?.[0]?.message?.content || "";

    if (!rawExtractedText.trim()) {
      throw new Error("El modelo de visión devolvió texto vacío.");
    }

    console.log(`[LiteRT Hybrid] Paso 1 completado (${rawExtractedText.length} caracteres transcritos).`);
  } catch (visionError: any) {
    console.warn(`[LiteRT Hybrid] Fallo en Paso 1 de visión: ${visionError.message}. Intentando fallback directo...`);
    // Fallback: Si el paso 1 falla, intenta la extracción directa de 1 paso
    return extractMenuWithLiteRT(images, {
      baseUrl: visionUrl,
      model: visionModel,
    });
  }

  // Paso 2: Gemma 4 26B (MoE) toma el texto, deduce los 14 alérgenos UE, traduce al inglés y emite JSON estricto
  console.log(`[LiteRT Hybrid] Paso 2: Deduciendo alérgenos y estructurando JSON con ${reasoningModel} en ${reasoningUrl}...`);

  try {
    const reasoningPrompt = `${GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT}

A continuación tienes la transcripción de la carta obtenida por el escáner visual:
--------------------
${rawExtractedText}
--------------------

Tu tarea es:
1. Limpiar y estructurar las categorías y platos.
2. Analizar los ingredientes de cada plato y deducir con exactitud los alérgenos aplicables de la UE según recetas tradicionales españolas:
   ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'dairy', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'].
   Heurística culinaria: croquetas ('dairy', 'gluten', 'eggs'), tortilla ('eggs'), ensaladilla ('eggs', 'fish', 'gluten'), bravas ('gluten', 'eggs'), calamares/chipirones ('molluscs', 'gluten'), gambas ('crustaceans'), guisos al vino ('sulphites', 'celery'), postres caseros ('dairy', 'eggs', 'gluten').
3. Traducir el nombre y descripción de cada plato al inglés con vocabulario gastronómico natural.
4. Responder EXCLUSIVAMENTE con un JSON válido con la siguiente estructura:
{
  "categories": [
    {
      "name_es": "Nombre de categoría",
      "name_en": "Category in English",
      "dishes": [
        {
          "name_es": "Nombre del plato",
          "name_en": "Dish name in English",
          "description_es": "Descripción de ingredientes",
          "description_en": "English description",
          "price": 8.50,
          "allergens": ["gluten", "dairy"]
        }
      ]
    }
  ]
}`;

    const reasoningRes = await fetch(`${reasoningUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: reasoningModel,
        messages: [{ role: "user", content: reasoningPrompt }],
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!reasoningRes.ok) {
      throw new Error(`Reasoning model HTTP error: ${reasoningRes.status}`);
    }

    const reasoningData = await reasoningRes.json();
    const rawJson = reasoningData?.choices?.[0]?.message?.content || "";

    let cleanedJson = rawJson
      .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const firstBrace = cleanedJson.indexOf("{");
    const lastBrace = cleanedJson.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanedJson = cleanedJson.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleanedJson);
    const validated = ExtractedMenuSchema.parse(parsed);

    console.log(`[LiteRT Hybrid] Pipeline híbrido completado con éxito!`);
    return validated;
  } catch (reasoningError: any) {
    console.error(`[LiteRT Hybrid] Error en Paso 2 de razonamiento:`, reasoningError);
    // Si falla el servidor de Gemma, intentamos fallback con MiniCPM directo
    console.log(`[LiteRT Hybrid] Fallback a extracción directa en MiniCPM-V...`);
    return extractMenuWithLiteRT(images, {
      baseUrl: visionUrl,
      model: visionModel,
    });
  }
}
