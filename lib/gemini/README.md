# `lib/gemini/` — Google Gemini Integration

## Purpose

Integration with Google's Generative Language API for menu image extraction. Features **dynamic model discovery**, **candidate-model cascade retry**, and strict JSON validation.

---

## Functions

### `extract.ts`

```ts
/**
 * Primary extraction function. Discovers available Flash models for the given API key,
 * tries each in priority order, returns the first validated result.
 */
async function extractMenuFromImages(
  images: ImageInput[],
  apiKeyOverride?: string,
  modelOverride?: string
): Promise<GeminiExtractionResult>
```

- **apiKeyOverride**: If provided, takes precedence over `GEMINI_API_KEY` env var.
- **modelOverride**: Arbitrary model name; if `"auto"` or omitted, dynamic discovery is used.

**Return**: `{ data: ExtractedMenu; modelUsed: string }`.

```ts
/** Returns a statically-defined demo menu. Called when no API key is configured or as fallback. */
function getMockExtractedMenu(): ExtractedMenu
```

### Internal Helpers (not exported)

```ts
async function fetchAvailableModels(apiKey: string): Promise<string[]>
// Queries GET https://generativelanguage.googleapis.com/v1beta/models?key=…
// Filters out audio/TTS/embedding/2.5 models that support generateContent.

function resolveCandidateModels(availableModels: string[], preferredModel?: string): Candidate[]
// Builds ordered list: user/env preference → dynamically discovered → hardcoded fallbacks.
```

---

## Model Cascade Strategy

When `extractMenuFromImages` runs, it iterates through candidate models in order:

1. User override or env var (`GEMINI_MODEL`).
2. Dynamically discovered models (prioritized: `gemini-flash-lite-latest`, `gemini-2.0-flash`, `gemini-1.5-flash-latest`, …).
3. Static fallback list (hardcoded priority queue).

Each candidate gets a **20-second timeout** via `AbortController` / `Promise.race`. Errors are handled as follows:

| Error Signal | Action |
|---|---|
| `401` / `API key not valid` | Break loop immediately (retry won't help). |
| `429` / `quota` / `ResourceExhausted` | Break loop immediately. |
| `404` / `not found` / `not supported` | Continue to next candidate. |
| Other transient errors | Continue to next candidate. |

After exhausting all candidates, a contextual `Error` is thrown distinguishing auth failures, quota exhaustion, model unavailability, and generic errors.

---

## Prompt & Schema

### System Prompt (`prompt.ts`)

```ts
const GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT: string
```

Defines rules for: category grouping, orthographic correction, price extraction (€ float, 0 for "según mercado"), EU-14 allergen heuristic mapping, English translation, and strict JSON-only output.

### Response Schema (`prompt.ts`)

```ts
const GEMINI_RESPONSE_SCHEMA: object  // JSON Schema object
```

Passed directly to Gemini's `generationConfig.responseSchema`. Defines:

```json
{
  "type": "object",
  "properties": {
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name_es": { "type": "string" },
          "name_en": { "type": "string" },
          "dishes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name_es": { "type": "string" },
                "name_en": { "type": "string" },
                "description_es": { "type": "string" },
                "description_en": { "type": "string" },
                "price": { "type": "number" },
                "allergens": { "type": "array", "items": { "type": "string" } }
              },
              "required": ["name_es", "price", "allergens"]
            }
          }
        },
        "required": ["name_es", "dishes"]
      }
    }
  },
  "required": ["categories"]
}
```

---

## Generation Config

For every Gemini call:

```ts
generationConfig: {
  responseMimeType: "application/json",
  responseSchema: GEMINI_RESPONSE_SCHEMA,
  temperature: 0.2,
}
systemInstruction: GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT
```

Low temperature (0.2) ensures deterministic parsing-friendly output.

---

## Dependencies

| Module | Depends On |
|---|---|
| `extract.ts` | `@google/generative-ai`, `prompt.ts`, `types.ts` (Zod schemas) |
| `prompt.ts` | None (pure constants) |

---

## Invariants & Side Effects

- **Invariant**: Final parsed JSON is ALWAYS validated against `ExtractedMenuSchema` (from `types.ts`) even though Gemini's `responseSchema` is used. Double-validation catches schema drift between SDK and Zod definitions.
- **Side effect**: HTTP POSTs to `generativelanguage.googleapis.com` — billed API calls. Rate limits apply.
- **Memory**: `GoogleGenerativeAI` instance created once per call (never cached globally).
- **No local artifacts**: Unlike `ai/litert*.ts` which talk to localhost, this module communicates only with Google's cloud API.
