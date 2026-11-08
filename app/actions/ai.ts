"use server";

import { extractMenu, ImageInput, ExtractionOptions } from "@/lib/ai";
import { ExtractedMenu } from "@/lib/types";

export interface ExtractMenuActionResult {
  success: boolean;
  data?: ExtractedMenu;
  provider?: "local" | "litert" | "litert_hybrid" | "gemini" | "mock";
  modelName?: string;
  error?: string;
  canFallbackToMock?: boolean;
}

export interface ProviderStatus {
  id: "auto" | "gemini" | "litert_hybrid" | "litert" | "local" | "mock";
  name: string;
  available: boolean;
  statusText: string;
  models?: string[];
}

export async function checkAiProvidersAction(): Promise<Record<string, ProviderStatus>> {
  const results: Record<string, ProviderStatus> = {};

  // 1. Mock Demo
  results["mock"] = {
    id: "mock",
    name: "Simulación Demo (Offline)",
    available: true,
    statusText: "Siempre disponible (sin internet ni API keys)",
  };

  // 2. Gemini Cloud
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  const hasGeminiKey = Boolean(geminiKey && geminiKey !== "your-gemini-api-key");
  const isValidFormat = geminiKey.startsWith("AIza");
  results["gemini"] = {
    id: "gemini",
    name: "Google Gemini Flash (Cloud)",
    available: hasGeminiKey,
    statusText: hasGeminiKey
      ? isValidFormat
        ? "Clave detectada en entorno (.env)"
        : "Clave configurada (formato no estándar)"
      : "Sin clave configurada",
  };

  // 3. Ollama Local
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(1000),
    });
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name);
      results["local"] = {
        id: "local",
        name: "Ollama Local",
        available: true,
        statusText: `Activo en ${ollamaUrl} (${models.length} modelos)`,
        models,
      };
    } else {
      results["local"] = {
        id: "local",
        name: "Ollama Local",
        available: false,
        statusText: `Error HTTP ${res.status}`,
      };
    }
  } catch {
    results["local"] = {
      id: "local",
      name: "Ollama Local",
      available: false,
      statusText: `No detectado en ${ollamaUrl}`,
    };
  }

  // 4. LiteRT Híbrido
  const visionUrl = process.env.LITERT_VISION_URL || "http://127.0.0.1:11436";
  const reasoningUrl = process.env.LITERT_REASONING_URL || "http://127.0.0.1:11435";
  try {
    const [vis, res] = await Promise.allSettled([
      fetch(`${visionUrl}/v1/models`, { signal: AbortSignal.timeout(800) }),
      fetch(`${reasoningUrl}/v1/models`, { signal: AbortSignal.timeout(800) }),
    ]);
    const visOk = vis.status === "fulfilled" && vis.value.ok;
    const resOk = res.status === "fulfilled" && res.value.ok;
    if (visOk && resOk) {
      results["litert_hybrid"] = {
        id: "litert_hybrid",
        name: "LiteRT Híbrido",
        available: true,
        statusText: "Activo (Puertos 11436 y 11435)",
      };
    } else {
      results["litert_hybrid"] = {
        id: "litert_hybrid",
        name: "LiteRT Híbrido",
        available: false,
        statusText: "No detectado en puertos 11436/11435",
      };
    }
  } catch {
    results["litert_hybrid"] = {
      id: "litert_hybrid",
      name: "LiteRT Híbrido",
      available: false,
      statusText: "No detectado",
    };
  }

  return results;
}

export async function extractMenuAction(
  formData: FormData
): Promise<ExtractMenuActionResult> {
  const startTime = Date.now();
  try {
    const images: ImageInput[] = [];
    const entries = formData.getAll("images");

    for (const entry of entries) {
      if (typeof entry === "string") {
        // base64 data url
        const matches = entry.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
          images.push({
            mimeType: matches[1],
            base64Data: matches[2],
          });
        }
      } else if (entry instanceof File) {
        const buffer = await entry.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        images.push({
          mimeType: entry.type || "image/jpeg",
          base64Data: base64,
        });
      }
    }

    const totalPayloadBytes = images.reduce(
      (acc, img) => acc + (img.base64Data?.length || 0) * 0.75,
      0
    );

    // Opciones del motor de inferencia enviadas desde el cliente
    const provider = formData.get("provider") as any;
    const apiKey = (formData.get("apiKey") as string | null) || undefined;
    const geminiModel = (formData.get("geminiModel") as string | null) || undefined;
    const ollamaBaseUrl =
      (formData.get("ollamaBaseUrl") as string | null) || undefined;
    const ollamaModel =
      (formData.get("ollamaModel") as string | null) || undefined;
    const litertVisionUrl =
      (formData.get("litertVisionUrl") as string | null) || undefined;
    const litertReasoningUrl =
      (formData.get("litertReasoningUrl") as string | null) || undefined;

    console.log(
      `[Nexo Server Action] Invocación extractMenuAction: ${images.length} imagen(es), ~${(
        totalPayloadBytes /
        1024 /
        1024
      ).toFixed(2)} MB, provider=${provider || "auto"}`
    );

    if (images.length === 0) {
      return {
        success: false,
        error: "Debes subir al menos una fotografía de la carta.",
      };
    }

    if (images.length > 4) {
      return {
        success: false,
        error: "El límite es de hasta 4 imágenes por escaneo.",
      };
    }

    const options: ExtractionOptions = {
      provider,
      apiKey,
      geminiModel,
      ollamaBaseUrl,
      ollamaModel,
      litertVisionUrl,
      litertReasoningUrl,
    };

    const result = await extractMenu(images, options);
    const latencyMs = Date.now() - startTime;
    const totalDishes =
      result.data?.categories?.reduce(
        (acc, cat) => acc + (cat.dishes?.length || 0),
        0
      ) || 0;

    console.log(
      `[Nexo Server Action] Inferencia completada con éxito en ${latencyMs}ms. Proveedor: ${result.provider} (${result.modelName}). Platos extraídos: ${totalDishes}`
    );

    return {
      success: true,
      data: result.data,
      provider: result.provider,
      modelName: result.modelName,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    console.error(
      `[Nexo Server Action] Fallo en extractMenuAction tras ${latencyMs}ms:`,
      error?.message || error
    );
    return {
      success: false,
      error: error.message || "Error al procesar la imagen con el motor de IA.",
      canFallbackToMock: true,
    };
  }
}
