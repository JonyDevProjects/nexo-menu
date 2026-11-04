import { ExtractedMenu, ExtractedMenuSchema } from "../types";
import { GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT } from "../gemini/prompt";

export interface LiteRTImageInput {
  base64Data: string;
  mimeType: string;
}

export async function extractMenuWithLiteRT(
  images: LiteRTImageInput[],
  options?: {
    model?: string;
    baseUrl?: string;
  }
): Promise<ExtractedMenu> {
  const baseUrl = options?.baseUrl || process.env.LITERT_BASE_URL || "http://127.0.0.1:11436";
  const model = options?.model || process.env.LITERT_MODEL || "minicpm-v4.7-1b";

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `${GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT}

Extrae todos los platos, categorías, precios y alérgenos de la UE de las imágenes proporcionadas.
Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "categories": [
    {
      "name_es": "Nombre de categoría",
      "name_en": "Category in English",
      "dishes": [
        {
          "name_es": "Nombre del plato",
          "name_en": "Name in English",
          "description_es": "Descripción",
          "description_en": "Description in English",
          "price": 8.50,
          "allergens": ["gluten", "dairy"]
        }
      ]
    }
  ]
}`,
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

  const endpoint = `${baseUrl}/v1/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
        max_tokens: 3000,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LiteRT API HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("El motor LiteRT-LM devolvió una respuesta vacía.");
    }

    // Limpiar posibles bloques markdown ```json ... ``` y etiquetas de pensamiento
    let cleanedJson = rawContent
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

    return validated;
  } catch (error: any) {
    console.error("Error en extractMenuWithLiteRT:", error);
    throw new Error(
      `Error al procesar con el motor LiteRT (${model}): ${error.message || error}`
    );
  }
}
