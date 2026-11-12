/**
 * ==============================================================================
 * NEXO PLATFORM - LITERT-LM LOCAL HYBRID INFERENCE DAEMON
 * Serves:
 *   - Port 11436: Vision Service (OCR & Tabular extraction with qwen3-vl / minicpm)
 *   - Port 11435: Reasoning Service (EU Allergens deduction & Zod JSON with gemma4)
 * Bridges directly with local Apple Silicon Metal GPU inference via Ollama.
 * ==============================================================================
 */

import http from "node:http";

const VISION_PORT = 11436;
const REASONING_PORT = 11435;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const VISION_MODEL = process.env.LITERT_VISION_MODEL || "qwen3-vl:8B";
const REASONING_MODEL = process.env.LITERT_REASONING_MODEL || "gemma4:26b-a4b-it-q4_K_M";
// Modelo de embedding local (LiteRT/Ollama). Es el que usa el Nexo-Palace
// Engine para el índice vectorial sin salir de la máquina.
const EMBEDDING_MODEL = process.env.LITERT_EMBEDDING_MODEL || "nomic-embed-text";

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

// -----------------------------------------------------------------------------
// 1. VISION SERVER (Port 11436)
// -----------------------------------------------------------------------------
const visionServer = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  // Health / Models check
  if (req.url === "/v1/models" || req.url === "/api/tags") {
    return sendJson(res, 200, {
      data: [
        { id: "minicpm-v4.7-1b", object: "model" },
        { id: "qwen3-vl:8B", object: "model" },
      ],
    });
  }

  if (req.url === "/v1/chat/completions" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const messages = payload.messages || [];
        const userMsg = messages[messages.length - 1];

        let textPrompt = "";
        const base64Images: string[] = [];

        if (Array.isArray(userMsg?.content)) {
          for (const part of userMsg.content) {
            if (part.type === "text") {
              textPrompt += part.text + "\n";
            } else if (part.type === "image_url") {
              const url = part.image_url?.url || "";
              const cleanB64 = url.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
              if (cleanB64) base64Images.push(cleanB64);
            }
          }
        } else if (typeof userMsg?.content === "string") {
          textPrompt = userMsg.content;
        }

        console.log(
          `[LiteRT-Vision :11436] Procesando ${base64Images.length} imágenes con ${VISION_MODEL}...`
        );

        // Call Ollama vision model
        const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: VISION_MODEL,
            messages: [
              {
                role: "user",
                content:
                  textPrompt ||
                  "Transcribe directamente y de forma exhaustiva todos los platos, categorías y precios visibles en esta carta. Sé directo y enumera cada elemento con su precio en euros.",
                images: base64Images,
              },
            ],
            options: {
              temperature: 0.1,
              num_predict: payload.max_tokens ? Math.max(payload.max_tokens, 4096) : 4096,
              num_ctx: 8192,
            },
            stream: false,
          }),
        });

        if (!ollamaRes.ok) {
          const err = await ollamaRes.text();
          throw new Error(`Ollama Vision HTTP ${ollamaRes.status}: ${err}`);
        }

        const ollamaData = await ollamaRes.json();
        let assistantContent = ollamaData?.message?.content || "";

        // Fallback to thinking if content is empty
        if (!assistantContent.trim() && ollamaData?.message?.thinking) {
          assistantContent = ollamaData.message.thinking;
        }

        // Strip thinking tags if any
        assistantContent = assistantContent.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();

        console.log(
          `[LiteRT-Vision :11436] Transcripción completada (${assistantContent.length} caracteres).`
        );

        sendJson(res, 200, {
          id: `chatcmpl-vision-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "minicpm-v4.7-1b",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: assistantContent,
              },
              finish_reason: "stop",
            },
          ],
        });
      } catch (err: any) {
        console.error("[LiteRT-Vision :11436] Error:", err);
        sendJson(res, 500, { error: err.message || "Internal server error" });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

// -----------------------------------------------------------------------------
// 2. REASONING SERVER (Port 11435)
// -----------------------------------------------------------------------------
const reasoningServer = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  // Health / Models check
  if (req.url === "/v1/models" || req.url === "/api/tags") {
    return sendJson(res, 200, {
      data: [
        { id: "gemma4-26b", object: "model" },
        { id: "gemma4:26b-a4b-it-q4_K_M", object: "model" },
        { id: EMBEDDING_MODEL, object: "model", type: "embedding" },
      ],
    });
  }

  // Embeddings locales (compatible con la API de OpenAI).
  if (req.url === "/v1/embeddings" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const rawInput = payload.input ?? payload.text ?? "";
        const inputs: string[] = Array.isArray(rawInput)
          ? rawInput.map((t: unknown) => String(t))
          : [String(rawInput)];

        console.log(
          `[LiteRT-Embedding :11435] Calculando ${inputs.length} embedding(s) con ${EMBEDDING_MODEL}...`,
        );

        const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: payload.model || EMBEDDING_MODEL, input: inputs }),
        });

        if (!ollamaRes.ok) {
          const detail = await ollamaRes.text().catch(() => "");
          return sendJson(res, ollamaRes.status, {
            error: `Ollama embeddings HTTP ${ollamaRes.status}: ${detail.slice(0, 300)}`,
          });
        }

        const ollamaJson = (await ollamaRes.json()) as { embeddings?: number[][] };
        const embeddings = ollamaJson.embeddings ?? [];

        return sendJson(res, 200, {
          object: "list",
          model: payload.model || EMBEDDING_MODEL,
          data: embeddings.map((embedding, index) => ({ object: "embedding", index, embedding })),
          usage: { prompt_tokens: 0, total_tokens: 0 },
        });
      } catch (err: any) {
        console.error("[LiteRT-Embedding :11435] Error:", err?.message || err);
        return sendJson(res, 500, { error: err?.message || "Error generating embeddings" });
      }
    });
    return;
  }

  if (req.url === "/v1/chat/completions" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const messages = payload.messages || [];
        const userMsg = messages[messages.length - 1];

        const textPrompt =
          typeof userMsg?.content === "string"
            ? userMsg.content
            : JSON.stringify(userMsg?.content || "");

        console.log(
          `[LiteRT-Reasoning :11435] Razonando sobre alérgenos y formato JSON con ${REASONING_MODEL}...`
        );

        // Call Ollama reasoning model
        const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: REASONING_MODEL,
            messages: [
              {
                role: "user",
                content: textPrompt,
              },
            ],
            options: {
              temperature: 0.15,
              num_predict: payload.max_tokens ? Math.max(payload.max_tokens, 4096) : 4096,
              num_ctx: 8192,
            },
            stream: false,
          }),
        });

        if (!ollamaRes.ok) {
          const err = await ollamaRes.text();
          throw new Error(`Ollama Reasoning HTTP ${ollamaRes.status}: ${err}`);
        }

        const ollamaData = await ollamaRes.json();
        let assistantContent = ollamaData?.message?.content || "";

        // Fallback to thinking if content is empty
        if (!assistantContent.trim() && ollamaData?.message?.thinking) {
          assistantContent = ollamaData.message.thinking;
        }

        // Strip thinking tags from gemma
        assistantContent = assistantContent
          .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
          .trim();

        // Extract clean JSON block if preamble exists
        const firstBrace = assistantContent.indexOf("{");
        const lastBrace = assistantContent.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          assistantContent = assistantContent.substring(firstBrace, lastBrace + 1);
        }

        console.log(`[LiteRT-Reasoning :11435] Estructuración JSON completada.`);

        sendJson(res, 200, {
          id: `chatcmpl-reasoning-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "gemma4-26b",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: assistantContent,
              },
              finish_reason: "stop",
            },
          ],
        });
      } catch (err: any) {
        console.error("[LiteRT-Reasoning :11435] Error:", err);
        sendJson(res, 500, { error: err.message || "Internal server error" });
      }
    });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

// Launch servers
visionServer.listen(VISION_PORT, "127.0.0.1", () => {
  console.log(`⚡ [LiteRT-LM Vision] Servidor escuchando en http://127.0.0.1:${VISION_PORT} (Modelo: ${VISION_MODEL})`);
});

reasoningServer.listen(REASONING_PORT, "127.0.0.1", () => {
  console.log(`🧠 [LiteRT-LM Reasoning] Servidor escuchando en http://127.0.0.1:${REASONING_PORT} (Modelo: ${REASONING_MODEL})`);
});
