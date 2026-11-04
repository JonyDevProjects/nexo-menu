import { extractMenuFromImages as extractWithGemini, getMockExtractedMenu } from "../gemini/extract";
import { extractMenuWithLocalOllama } from "./local";
import { extractMenuWithLiteRT } from "./litert";
import { extractMenuWithLiteRTHybrid } from "./litert_hybrid";
import { ExtractedMenu } from "../types";

export interface ImageInput {
  base64Data: string;
  mimeType: string;
}

export interface ExtractionOptions {
  provider?: "auto" | "gemini" | "litert_hybrid" | "litert" | "local" | "mock";
  apiKey?: string;
  geminiModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  litertVisionUrl?: string;
  litertReasoningUrl?: string;
}

export interface ExtractionResult {
  data: ExtractedMenu;
  provider: "local" | "litert" | "gemini" | "mock";
  modelName: string;
}

export async function extractMenu(
  images: ImageInput[],
  options?: ExtractionOptions
): Promise<ExtractionResult> {
  const provider = (options?.provider || process.env.AI_PROVIDER || "auto").toLowerCase();
  
  // 1. Forzar Simulación Demo
  if (provider === "mock") {
    console.log("[AI Engine] Ejecutando Simulación Demo...");
    return {
      data: getMockExtractedMenu(),
      provider: "mock",
      modelName: "Simulación Demo (Offline)",
    };
  }

  // 2. Forzar Pipeline Híbrido LiteRT (MiniCPM-V 4.7 + Gemma 4 26B)
  if (provider === "hybrid" || provider === "litert_hybrid") {
    console.log(`[AI Engine] Ejecutando Pipeline Híbrido LiteRT (MiniCPM-V 1B + Gemma 4 26B)...`);
    const data = await extractMenuWithLiteRTHybrid(images, {
      visionUrl: options?.litertVisionUrl,
      reasoningUrl: options?.litertReasoningUrl,
    });
    return {
      data,
      provider: "litert",
      modelName: "LiteRT Híbrido (MiniCPM-V 1B + Gemma 26B)",
    };
  }

  // 3. Forzar LiteRT-LM (un solo paso)
  if (provider === "litert") {
    const litertModel = options?.ollamaModel || process.env.LITERT_MODEL || "minicpm-v4.7-1b";
    const litertBaseUrl = options?.litertVisionUrl || process.env.LITERT_BASE_URL || "http://127.0.0.1:11436";
    console.log(`[AI Engine] Ejecutando LiteRT-LM (${litertModel})...`);
    const data = await extractMenuWithLiteRT(images, {
      model: litertModel,
      baseUrl: litertBaseUrl,
    });
    return { data, provider: "litert", modelName: `LiteRT (${litertModel})` };
  }

  // 4. Forzar Ollama
  if (provider === "local" || provider === "ollama") {
    const ollamaModel = options?.ollamaModel || process.env.OLLAMA_MODEL || "qwen3-vl:8B";
    const ollamaBaseUrl = options?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    console.log(`[AI Engine] Ejecutando Ollama (${ollamaModel}) en ${ollamaBaseUrl}...`);
    const data = await extractMenuWithLocalOllama(images, {
      model: ollamaModel,
      baseUrl: ollamaBaseUrl,
    });
    return { data, provider: "local", modelName: `Ollama (${ollamaModel})` };
  }

  // 5. Forzar Google Gemini Cloud
  if (provider === "gemini") {
    console.log("[AI Engine] Ejecutando Google Gemini Flash API...");
    const res = await extractWithGemini(images, options?.apiKey, options?.geminiModel);
    return { data: res.data, provider: "gemini", modelName: `Gemini (${res.modelUsed})` };
  }

  // 6. Modo Auto (Prioridad: LiteRT Híbrido -> LiteRT Simple -> Ollama -> Gemini -> Mock)
  // Comprobar si ambos puertos de LiteRT están activos (11436 para Vision y 11435 para Reasoning)
  const visionUrl = options?.litertVisionUrl || process.env.LITERT_VISION_URL || "http://127.0.0.1:11436";
  const reasoningUrl = options?.litertReasoningUrl || process.env.LITERT_REASONING_URL || "http://127.0.0.1:11435";
  
  try {
    const [visCheck, resCheck] = await Promise.allSettled([
      fetch(`${visionUrl}/v1/models`, { signal: AbortSignal.timeout(600) }),
      fetch(`${reasoningUrl}/v1/models`, { signal: AbortSignal.timeout(600) }),
    ]);

    const isVisionUp = visCheck.status === "fulfilled" && visCheck.value.ok;
    const isReasoningUp = resCheck.status === "fulfilled" && resCheck.value.ok;

    if (isVisionUp && isReasoningUp) {
      console.log("[AI Engine Auto] Detectados ambos servidores LiteRT (Vision :11436 y Reasoning :11435). Activando Pipeline Híbrido...");
      const data = await extractMenuWithLiteRTHybrid(images, { visionUrl, reasoningUrl });
      return {
        data,
        provider: "litert",
        modelName: "LiteRT Híbrido (MiniCPM-V 1B + Gemma 26B)",
      };
    } else if (isVisionUp) {
      console.log("[AI Engine Auto] Detectado LiteRT Vision en :11436. Ejecutando extracción directa...");
      const data = await extractMenuWithLiteRT(images, { baseUrl: visionUrl });
      return { data, provider: "litert", modelName: "LiteRT (MiniCPM-V 1B)" };
    }
  } catch {
    // LiteRT no disponible
  }

  // Check Ollama
  const ollamaBaseUrl = options?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  try {
    const ollamaCheck = await fetch(`${ollamaBaseUrl}/api/tags`, {
      signal: AbortSignal.timeout(600),
    });

    if (ollamaCheck.ok) {
      const ollamaModel = options?.ollamaModel || process.env.OLLAMA_MODEL || "qwen3-vl:8B";
      console.log(`[AI Engine Auto] Ollama detectado en ${ollamaBaseUrl}. Usando ${ollamaModel}...`);
      const data = await extractMenuWithLocalOllama(images, {
        model: ollamaModel,
        baseUrl: ollamaBaseUrl,
      });
      return { data, provider: "local", modelName: `Ollama (${ollamaModel})` };
    }
  } catch {
    // Ollama no disponible
  }

  // Check Gemini Cloud
  const geminiKey = options?.apiKey || process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== "your-gemini-api-key") {
    try {
      console.log("[AI Engine Auto] Usando Google Gemini Flash...");
      const res = await extractWithGemini(images, geminiKey, options?.geminiModel);
      return { data: res.data, provider: "gemini", modelName: `Gemini (${res.modelUsed})` };
    } catch (err: any) {
      console.warn("[AI Engine Auto] Falló Gemini en modo auto, usando simulación:", err.message);
      return {
        data: getMockExtractedMenu(),
        provider: "mock",
        modelName: "Simulación Demo (Fallback por error en Gemini)",
      };
    }
  }

  // Fallback Mock
  console.log("[AI Engine Auto] Ningún motor local ni API externa detectados. Usando simulación.");
  return {
    data: getMockExtractedMenu(),
    provider: "mock",
    modelName: "Simulación Demo",
  };
}
