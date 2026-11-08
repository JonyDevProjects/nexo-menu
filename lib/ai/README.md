# `lib/ai/` — AI Extraction Pipeline

## Purpose

Unified abstraction for extracting structured menu data from photographs of restaurant menus. Supports multiple AI backends (LiteRT hybrid, LiteRT-LM, Ollama local, Gemini cloud, mock) with automatic detection and graceful degradation.

---

## Entry Point

```ts
async function extractMenu(
  images: ImageInput[],
  options?: ExtractionOptions
): Promise<ExtractionResult>
```

- **Dispatcher**: Selects which backend to invoke based on `options.provider` or environment defaults.
- **Returns**: `{ data: ExtractedMenu, provider: string, modelName: string }`.

---

## Backends

### `litert_hybrid.ts` — Two-phase LiteRT Pipeline

```ts
async function extractMenuWithLiteRTHybrid(
  images: LiteRTImageInput[],
  options?: LiteRTHybridOptions
): Promise<ExtractedMenu>
```

| Phase | Model | Endpoint | Output |
|---|---|---|---|
| Vision (Step 1) | MiniCPM-V 4.7-1B (default) | `/v1/chat/completions` on `VISION_URL` | Raw transcribed text of dishes, prices, descriptions |
| Reasoning (Step 2) | Gemma 4 26B A4B (default) | `/v1/chat/completions` on `REASONING_URL` | Strict JSON with EU allergens, EN translation, validated structure |

**Fallback**: If either phase fails, drops to single-step `extractMenuWithLiteRT` (direct MiniCPM extraction).

**Options**:
```ts
interface LiteRTHybridOptions {
  visionUrl?: string;       // default http://127.0.0.1:11436
  visionModel?: string;     // default minicpm-v4.7-1b
  reasoningUrl?: string;    // default http://127.0.0.1:11435
  reasoningModel?: string;  // default gemma4-26b
}
```

### `litert.ts` — Single-step LiteRT-LM

```ts
async function extractMenuWithLiteRT(
  images: LiteRTImageInput[],
  options?: { model?: string; baseUrl?: string }
): Promise<ExtractedMenu>
```

- Single VQA call to MiniCPM-V sending images + system prompt asking for strict JSON.
- Cleans markdown blocks, extracts braces, parses + validates with Zod.
- Throws descriptive error on failure.

### `local.ts` — Ollama Local Model

```ts
async function extractMenuWithLocalOllama(
  images: LocalImageInput[],
  options?: { model?: string; baseUrl?: string }
): Promise<ExtractedMenu>
```

- Calls `/api/chat` on Ollama's OpenAI-compatible endpoint.
- Strips `data:image/...;base64,` prefix (Ollama expects raw base64).
- Sets `temperature: 0.2` and `format: "json"` for deterministic output.
- Falls back to `thinking` content block if `message.content` is empty.

### `index.ts` — Mock Provider

Accessible by setting `provider: "mock"`. Returns the static demo menu defined in `gemini/extract.ts::getMockExtractedMenu()`. Provider label in result is `"mock"`.

---

## Auto Mode Protocol (default `provider: "auto"`)

1. Simultaneously health-check LiteRT Vision + Reasoning servers (`AbortSignal.timeout(600 ms)`).
2. If both → run hybrid pipeline.
3. If only vision → run single-step LiteRT.
4. Health-check Ollama (`/api/tags`).
5. If available → run Ollama extraction.
6. If no local engines + `GEMINI_API_KEY` set → try Gemini cloud (cascading model list, see `gemini/`).
7. Gemini failure or missing key → mock fallback.

---

## Input / Output Types

```ts
interface ImageInput { base64Data: string; mimeType: string; }
interface ExtractionOptions {
  provider?: "auto" | "gemini" | "litert_hybrid" | "litert" | "local" | "mock";
  apiKey?: string;
  geminiModel?: string;
  ollamaBaseUrl?: string; ollamaModel?: string;
  litertVisionUrl?: string; litertReasoningUrl?: string;
}
interface ExtractionResult {
  data: ExtractedMenu;                           // always passes ExtractedMenuSchema.validate
  provider: "local" | "litert" | "gemini" | "mock";
  modelName: string;                              // human-readable identifier
}
```

---

## Dependencies

| Module | Depends On |
|---|---|
| `index.ts` | `gemini/extract.ts`, `local.ts`, `litert.ts`, `litert_hybrid.ts`, `types.ts` |
| `litert.ts` | `types.ts`, `gemini/prompt.ts` |
| `litert_hybrid.ts` | `types.ts`, `gemini/prompt.ts`, `litert.ts` |
| `local.ts` | `types.ts`, `gemini/prompt.ts` |

---

## Invariants & Side Effects

- **Output invariant**: Every successful result passes `ExtractedMenuSchema.parse()` — malformed JSON from any backend triggers an exception; no partial results escape.
- **JSON cleaning**: All backends strip `<thought>...</thought>` blocks, ````json```` fences, and extract the innermost `{...}` pair.
- **Network side effects**: Each backend makes 1–2 synchronous HTTP POSTs. Timeouts are hard-coded per-backend (LiteRT: no explicit timeout; Ollama: server-dependent; Gemini: 20 s per attempt).
- **Logging**: Verbose console logs prefixed `[AI Engine]`, `[LiteRT Hybrid]`, `[LiteRT LM]`, etc. Do NOT swallow errors from failed phases where a meaningful fallback exists.
- **No state mutation**: Modules are pure functions — no caching, no global state, no persistent writes.
