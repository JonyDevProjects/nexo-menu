import * as fs from "node:fs";
import * as path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT, GEMINI_RESPONSE_SCHEMA } from "./prompt";
import { ExtractedMenu, ExtractedMenuSchema } from "../types";

export interface ImageInput {
  base64Data: string;
  mimeType: string;
}

export interface GeminiExtractionResult {
  data: ExtractedMenu;
  modelUsed: string;
}

/**
 * Lee la clave configurada en los archivos locales .env.local o .env
 */
function getEnvApiKey(): string {
  try {
    for (const envFile of [".env.local", ".env"]) {
      const fullPath = path.resolve(process.cwd(), envFile);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const match = content.match(/^GEMINI_API_KEY=(.*)$/m);
        if (match && match[1]?.trim()) {
          return match[1].trim();
        }
      }
    }
  } catch {
    // fallback a process.env
  }
  return (process.env.GEMINI_API_KEY || "").trim();
}

/**
 * Obtiene la clave de API efectiva dando prioridad al archivo .env / .env.local
 * para evitar que variables obsoletas del entorno global (p. ej. en ~/.zshrc)
 * sobreescriban la clave válida configurada localmente en el proyecto.
 */
function getEffectiveApiKey(apiKeyOverride?: string): string {
  if (apiKeyOverride && apiKeyOverride.trim()) {
    return apiKeyOverride.trim();
  }
  return getEnvApiKey();
}

/**
 * Consulta la lista de modelos permitidos para la clave de API activa mediante ModelService.ListModels.
 * Permite autodescubrir qué variantes (gemini-flash-lite-latest, gemini-2.0-flash, gemini-1.5-flash-latest, etc.)
 * están aprovisionadas en la cuenta de Google AI Studio del usuario.
 */
async function fetchAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) {
      console.warn(`[Gemini ListModels] HTTP ${res.status}: ${res.statusText}`);
      return [];
    }
    const json = await res.json();
    if (!Array.isArray(json.models)) return [];

    return json.models
      .filter(
        (m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes("generateContent") &&
          !String(m.name).toLowerCase().includes("tts") &&
          !String(m.name).toLowerCase().includes("audio") &&
          !String(m.name).toLowerCase().includes("embedding") &&
          !String(m.name).toLowerCase().includes("2.5")
      )
      .map((m: any) => String(m.name).replace(/^models\//, ""));
  } catch (err: any) {
    console.warn("[Gemini ListModels] No se pudo consultar la lista dinámica de modelos:", err?.message || err);
    return [];
  }
}

/**
 * Resuelve la lista ordenada de configuraciones de modelo a intentar.
 * Evita bloqueos por 404 iterando sobre los modelos flash soportados.
 */
function resolveCandidateModels(
  availableModels: string[],
  preferredModel?: string
): Array<{ model: string; apiVersion?: string }> {
  const candidates: Array<{ model: string; apiVersion?: string }> = [];

  const addCandidate = (model: string, apiVersion?: string) => {
    const clean = model.replace(/^models\//, "").trim();
    if (!clean || clean.includes("2.5")) return;
    if (!candidates.some((c) => c.model === clean && c.apiVersion === apiVersion)) {
      candidates.push({ model: clean, apiVersion });
    }
  };

  // 1. Modelo preferido por el usuario o entorno
  const envModel = process.env.GEMINI_MODEL;
  if (preferredModel && preferredModel !== "auto" && !preferredModel.includes("2.5")) {
    addCandidate(preferredModel);
  }
  if (envModel && envModel !== "auto" && !envModel.includes("2.5")) {
    addCandidate(envModel);
  }

  // 2. Modelos reportados dinámicamente por la API de Google (prioridad: estables y rápidos)
  if (availableModels.length > 0) {
    const priorityList = [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-flash-002",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro-latest",
      "gemini-1.5-pro",
    ];

    for (const prio of priorityList) {
      if (availableModels.includes(prio)) {
        addCandidate(prio);
      }
    }

    // Cualquier otro modelo flash visual (excluyendo audio, tts y 2.5)
    for (const m of availableModels) {
      const lower = m.toLowerCase();
      if (lower.includes("flash") && !lower.includes("tts") && !lower.includes("audio") && !lower.includes("2.5")) {
        addCandidate(m);
      }
    }

    // Cualquier otro modelo con soporte generateContent visual
    for (const m of availableModels) {
      const lower = m.toLowerCase();
      if (!lower.includes("tts") && !lower.includes("audio") && !lower.includes("embedding") && !lower.includes("2.5")) {
        addCandidate(m);
      }
    }
  }

  // 3. Fallback estático estándar (si ListModels no devolvió resultados)
  const defaultStaticList = [
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
  ];

  for (const m of defaultStaticList) {
    addCandidate(m);
  }

  // Añadir también gemini-1.5-flash con apiVersion: "v1" explícita
  addCandidate("gemini-1.5-flash", "v1");

  return candidates;
}

export async function extractMenuFromImages(
  images: ImageInput[],
  apiKeyOverride?: string,
  modelOverride?: string
): Promise<GeminiExtractionResult> {
  let apiKey = getEffectiveApiKey(apiKeyOverride);
  const envKey = getEnvApiKey();

  console.log(
    `[Gemini Auth] Usando clave terminada en: ...${apiKey.slice(-4)} (origen: ${
      apiKeyOverride ? "CLIENTE (formulario/localStorage)" : "SERVIDOR (.env)"
    })`
  );

  if (!apiKey || apiKey === "your-gemini-api-key") {
    console.warn("GEMINI_API_KEY no configurada. Usando respuesta simulada para pruebas de desarrollo.");
    return {
      data: getMockExtractedMenu(),
      modelUsed: "Simulación Demo (Offline)",
    };
  }

  // 1. Descubrir modelos activos para la clave de API
  let availableModels = await fetchAvailableModels(apiKey);
  if (availableModels.length === 0 && apiKeyOverride && envKey && apiKey !== envKey) {
    console.warn(
      `[Gemini Auth] La clave enviada por el navegador (...${apiKey.slice(
        -4
      )}) no devolvió modelos o dio 401. Probando con clave de servidor (.env)...`
    );
    const envModels = await fetchAvailableModels(envKey);
    if (envModels.length > 0) {
      console.log(
        `[Gemini Auth] Clave de servidor (.env) válida y autenticada (...${envKey.slice(
          -4
        )}). Sustituyendo clave.`
      );
      apiKey = envKey;
      availableModels = envModels;
    }
  }

  let genAI = new GoogleGenerativeAI(apiKey);

  const imageParts = images.map((img) => ({
    inlineData: {
      data: img.base64Data.replace(/^data:image\/[a-z]+;base64,/, ""),
      mimeType: img.mimeType,
    },
  }));

  const prompt =
    "Analiza y extrae minuciosamente todos los platos, categorías, precios en euros y alérgenos de la UE de esta carta:";

  if (availableModels.length > 0) {
    console.log(`[Gemini] Modelos activos detectados para esta clave:`, availableModels.slice(0, 5).join(", "));
  }

  // 2. Resolver candidatos ordenados
  const candidateConfigs = resolveCandidateModels(availableModels, modelOverride);

  // 3. Global cascade timeout (~45s total para toda la cascada)
  const cascadeController = new AbortController();
  const cascadeTimeoutMs = 45000;
  let cascadeTimer: NodeJS.Timeout | null = null;

  const cascadeTimeoutPromise = new Promise<never>((_, reject) => {
    cascadeTimer = setTimeout(() => {
      cascadeController.abort();
      reject(new Error(`Timeout global de cascada: ${cascadeTimeoutMs}ms excedido`));
    }, cascadeTimeoutMs);
  });

  let lastError: any = null;
  let successfulResult: GeminiExtractionResult | null = null;

  // 4. Cascada de ejecución con autorrecuperación
  for (const config of candidateConfigs) {
    // Verificar si la cascada global fue abortada
    if (cascadeController.signal.aborted) {
      console.warn("[Gemini] Cascada abortada por timeout global");
      break;
    }

    const timeoutMs = 20000; // Timeout de 20s por intento con AbortController
    const abortController = new AbortController();
    let timer: NodeJS.Timeout | null = null;

    const modelTimeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        abortController.abort();
        reject(new Error(`Timeout de ${timeoutMs}ms superado para modelo ${config.model}`));
      }, timeoutMs);
    });

    const requestOptions: any = {
      signal: abortController.signal,
      timeout: timeoutMs,
    };
    if (config.apiVersion) {
      requestOptions.apiVersion = config.apiVersion;
    }

    try {
      console.log(
        `[Gemini] Ejecutando extracción con modelo: ${config.model}${
          config.apiVersion ? ` (endpoint ${config.apiVersion})` : ""
        }...`
      );

      const model = genAI.getGenerativeModel(
        {
          model: config.model,
          generationConfig: {
            responseMimeType: "application/json",
            // @ts-expect-error responseSchema is supported in Gemini 1.5+
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            temperature: 0.2,
          },
          systemInstruction: GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT,
        },
        requestOptions
      );

      const generatePromise = model.generateContent([prompt, ...imageParts]);
      let result: any;
      try {
        result = await Promise.race([generatePromise, modelTimeoutPromise, cascadeTimeoutPromise]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const responseText = result.response.text();

      try {
        const parsedJson = JSON.parse(responseText);
        const validated = ExtractedMenuSchema.parse(parsedJson);

        console.log(`[Gemini] Extracción completada con éxito usando ${config.model}`);
        successfulResult = {
          data: validated,
          modelUsed: config.model,
        };
        break;
      } catch (parseErr) {
        console.error(`[Gemini] Error al parsear JSON con ${config.model}:`, parseErr, responseText);
        throw new Error(
          "No se pudo extraer la carta en un formato válido. Por favor, reintenta con una foto más nítida."
        );
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      console.warn(`[Gemini] Falló intento con ${config.model}:`, errMsg);

      // Si es un error de autenticación 401 y estábamos usando una clave del cliente distinta a la del servidor (.env),
      // conmutamos automáticamente a la clave del servidor y reintentamos.
      if (
        (errMsg.includes("401") ||
          errMsg.includes("API key not valid") ||
          errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")) &&
        apiKeyOverride &&
        envKey &&
        apiKey !== envKey
      ) {
        console.warn(
          `[Gemini Auth] Error 401 con clave del navegador. Conmutando a clave válida del servidor (.env)...`
        );
        apiKey = envKey;
        genAI = new GoogleGenerativeAI(apiKey);
        try {
          const fallbackModel = genAI.getGenerativeModel(
            {
              model: config.model,
              generationConfig: {
                responseMimeType: "application/json",
                // @ts-expect-error responseSchema is supported in Gemini 1.5+
                responseSchema: GEMINI_RESPONSE_SCHEMA,
                temperature: 0.2,
              },
              systemInstruction: GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT,
            },
            requestOptions
          );
          const genFallback = await fallbackModel.generateContent([prompt, ...imageParts]);
          const textFallback = genFallback.response.text();
          const parsed = ExtractedMenuSchema.parse(JSON.parse(textFallback));
          console.log(`[Gemini] Extracción completada con éxito usando clave del servidor (.env) y modelo ${config.model}`);
          successfulResult = {
            data: parsed,
            modelUsed: config.model,
          };
          break;
        } catch (rescueErr) {
          console.warn("[Gemini Auth] Reintento de rescate con clave de .env falló:", rescueErr);
        }
      }

      // Si es un error de autenticación 401 definitivo o cuota 429, no es problema del modelo: salir inmediatamente
      if (
        errMsg.includes("401") ||
        errMsg.includes("API key not valid") ||
        errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED") ||
        errMsg.includes("429") ||
        errMsg.includes("quota") ||
        errMsg.includes("ResourceExhausted")
      ) {
        break;
      }

      // Si es 404 (modelo no encontrado o no soportado en v1beta), continuar al siguiente candidato
      if (
        errMsg.includes("404") ||
        errMsg.includes("not found") ||
        errMsg.includes("not supported")
      ) {
        continue;
      }

      // Otros errores de conexión puntual
      continue;
    }
  }

  // Limpiar timer de cascada al salir
  if (cascadeTimer) clearTimeout(cascadeTimer);

  if (successfulResult) {
    return successfulResult;
  }

  // Si ninguno tuvo éxito, formatear error descriptivo
  console.error("Error definitivo en llamada a Gemini:", lastError);
  const msg = lastError?.message || String(lastError);

  if (
    msg.includes("401") ||
    msg.includes("API key not valid") ||
    msg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")
  ) {
    throw new Error(
      "Clave de API de Gemini no válida o sin permisos (Error 401). Verifica tu clave en Google AI Studio (https://aistudio.google.com/app/apikey) o prueba con 'Simulación Demo' en el panel."
    );
  }

  if (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("ResourceExhausted")
  ) {
    throw new Error(
      "Se ha superado la cuota de la API de Gemini (Error 429). Puedes usar 'Simulación Demo' o un motor local (Ollama/LiteRT) para continuar probando."
    );
  }

  if (
    msg.includes("404") ||
    msg.includes("not found") ||
    msg.includes("not supported for generateContent")
  ) {
    throw new Error(
      "Los modelos de Gemini Flash no están disponibles para esta clave de API o región (Error 404). Comprueba en Google Cloud Console que tu proyecto tenga habilitada la 'Generative Language API', o selecciona 'Simulación Demo' para continuar."
    );
  }

  throw lastError || new Error("Ocurrió un error al procesar la carta con Gemini.");
}

export function getMockExtractedMenu(): ExtractedMenu {
  return {
    categories: [
      {
        name_es: "Tapas y Raciones",
        name_en: "Tapas and Portions",
        dishes: [
          {
            name_es: "Croquetas Caseras de Jamón Ibérico (6 uds)",
            name_en: "Homemade Iberian Ham Croquettes (6 pcs)",
            description_es: "Bechamel cremosa tradicional con taquitos de jamón de bellota",
            description_en: "Traditional creamy bechamel with acorn-fed Iberian ham cubes",
            price: 9.5,
            allergens: ["gluten", "dairy", "eggs"],
          },
          {
            name_es: "Patatas Bravas de la Casa",
            name_en: "House Special Spicy Potatoes (Bravas)",
            description_es: "Patatas crujientes con salsa brava artesanal ligeramente picante y alioli suave",
            description_en: "Crispy potatoes served with homemade spicy brava sauce and garlic alioli",
            price: 6.0,
            allergens: ["gluten", "eggs"],
          },
          {
            name_es: "Calamares a la Andaluza",
            name_en: "Andalusian-Style Fried Squid",
            description_es: "Anillas de calamar fresco enharinadas y fritas en aceite de oliva con limón",
            description_en: "Fresh squid rings lightly floured and fried in olive oil, served with lemon",
            price: 11.5,
            allergens: ["gluten", "molluscs"],
          },
        ],
      },
      {
        name_es: "Carnes y Hamburguesas",
        name_en: "Meats and Burgers",
        dishes: [
          {
            name_es: "Smash Burger Clásica",
            name_en: "Classic Smash Burger",
            description_es: "Doble carne de ternera madurada (180g), queso cheddar fundido, pepinillos y salsa burger",
            description_en: "Double aged beef patty, melted cheddar cheese, pickles and signature burger sauce",
            price: 10.9,
            allergens: ["gluten", "dairy", "eggs", "mustard", "sesame"],
          },
          {
            name_es: "Secreto Ibérico a la Brasa",
            name_en: "Grilled Iberian Pork Secret",
            description_es: "Pieza tierna de cerdo ibérico con escamas de sal maldon y patatas panaderas",
            description_en: "Tender cut of Iberian pork grilled with maldon salt flakes and baked potatoes",
            price: 14.5,
            allergens: [],
          },
        ],
      },
      {
        name_es: "Postres y Bebidas",
        name_en: "Desserts and Drinks",
        dishes: [
          {
            name_es: "Tarta de Queso Fluida al Horno",
            name_en: "Baked Creamy Cheesecake",
            description_es: "Tarta de queso estilo Donostia con corazón cremoso",
            description_en: "San Sebastian style cheesecake with a melted creamy heart",
            price: 5.5,
            allergens: ["dairy", "eggs", "gluten"],
          },
          {
            name_es: "Caña de Cerveza de Barril",
            name_en: "Draft Beer",
            description_es: "Cerveza rubia bien fría tirada al momento",
            description_en: "Cold draft lager beer",
            price: 2.2,
            allergens: ["gluten"],
          },
        ],
      },
    ],
  };
}
