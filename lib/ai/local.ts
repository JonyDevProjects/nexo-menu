import { ExtractedMenu, ExtractedMenuSchema } from "../types";
import { GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT } from "../gemini/prompt";

export interface LocalImageInput {
  base64Data: string;
  mimeType: string;
}

export async function extractMenuWithLocalOllama(
  images: LocalImageInput[],
  options?: {
    model?: string;
    baseUrl?: string;
  }
): Promise<ExtractedMenu> {
  const baseUrl = options?.baseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = options?.model || process.env.OLLAMA_MODEL || "qwen3-vl:8B";

  // Ollama expects base64 strings without the 'data:image/...;base64,' prefix
  const cleanBase64Images = images.map((img) =>
    img.base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, "")
  );

  const prompt = `${GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT}

Analiza minuciosamente estas imágenes de la carta y devuelve un objeto JSON estrictamente con la siguiente estructura:
{
  "categories": [
    {
      "name_es": "Nombre de categoría",
      "name_en": "Category name in English",
      "dishes": [
        {
          "name_es": "Nombre del plato",
          "name_en": "Dish name in English",
          "description_es": "Descripción de ingredientes",
          "description_en": "Description in English",
          "price": 8.50,
          "allergens": ["gluten", "dairy", "eggs"]
        }
      ]
    }
  ]
}

Responde ÚNICAMENTE con el objeto JSON válido.`;

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt,
            images: cleanBase64Images,
          },
        ],
        format: "json",
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    let content = data?.message?.content || "";
    if (!content.trim() && data?.message?.thinking) {
      content = data.message.thinking;
    }

    if (!content) {
      throw new Error("El modelo local Ollama devolvió una respuesta vacía.");
    }

    // Parse and validate with Zod
    let cleanedJson = content
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
    console.error("Error en extractMenuWithLocalOllama:", error);
    throw new Error(
      `Error al procesar con el modelo local (${model}): ${error.message || error}`
    );
  }
}
