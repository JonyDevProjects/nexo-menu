# Nexo Menu — `lib/`

## Purpose

Shared library for the Nexo Menu application. Provides the data types, AI-powered menu extraction pipeline, Supabase client factories, local storage, utilities, and allergen reference data used across the Next.js app (pages, components, API routes).

---

## Directory Structure

| Subdirectory | Role |
|---|---|
| `types.ts` *(root)* | Core TypeScript interfaces & Zod schemas for restaurants, categories, dishes, extracted menus. |
| `utils.ts` *(root)* | Shared helpers (`cn`, `formatPrice`). |
| `allergens.ts` *(root)* | Reference data for the 14 EU-mandated allergen codes. |
| `ai/` | AI abstraction layer — single entry point (`extractMenu`) that dispatches to pluggable backends: **LiteRT Hybrid**, **LiteRT-LM**, **Ollama (local)**, **Gemini Cloud**, or **Mock**. |
| `supabase/` | Three factory functions that return typed Supabase clients for browser, server, and public read contexts. |
| `data/` | Persistence + fetch layer: in-memory/file-backed cache (`localStore`) and the cached public-menu resolver (`menu`). |
| `gemini/` | Google Gemini integration: model auto-discovery, candidate cascade, prompt templates, and the extraction function itself. |
| `utils/` | Client-side utility (image compressor). |

---

## Key Exports

### Root (`types.ts`)

```ts
// Interfaces
interface Restaurant { ... }
interface Category { dishes?: Dish[]; ... }
interface Dish { ... }
interface FullMenuData { restaurant: Restaurant; categories: [...]; }

// Zod schemas (with pre-processors for LLM output variance)
const ExtractedDishSchema   = z.preprocess(...), z.object({...})
const ExtractedCategorySchema = z.preprocess(...), z.object({...})
const ExtractedMenuSchema   = z.object({ categories: z.array(ExtractedCategorySchema) })

// Type aliases
type ExtractedMenu    = z.infer<typeof ExtractedMenuSchema>
type ExtractedCategory = z.infer<typeof ExtractedCategorySchema>
type ExtractedDish     = z.infer<typeof ExtractedDishSchema>
```

### Root (`utils.ts`)

```ts
function cn(...inputs: ClassValue[]): string
function formatPrice(price: number, currency?: string): string
```

### Root (`allergens.ts`)

```ts
interface AllergenDefinition { code: string; nameEs: string; nameEn: string; icon: string; descriptionEs: string; }
const EU_ALLERGENS: AllergenDefinition[]       // 14-item constant array
const ALLERGENS_MAP: Map<string, AllergenDefinition>
function getAllergenInfo(code: string): AllergenDefinition | undefined
```

### `ai/index.ts`

```ts
interface ImageInput  { base64Data: string; mimeType: string; }
interface ExtractionOptions {
  provider?: "auto" | "gemini" | "litert_hybrid" | "litert" | "local" | "mock";
  apiKey?: string;
  geminiModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  litertVisionUrl?: string;
  litertReasoningUrl?: string;
}
interface ExtractionResult { data: ExtractedMenu; provider: "local" | "litert" | "gemini" | "mock"; modelName: string; }

async function extractMenu(images: ImageInput[], options?: ExtractionOptions): Promise<ExtractionResult>
```

### `supabase/client.ts`

```ts
function createClient(): SupabaseClient   // Browser client (@supabase/ssr)
```

### `supabase/server.ts`

```ts
async function createServerSupabaseClient(): Promise<SupabaseClient>
```

### `supabase/public.ts`

```ts
function createPublicSupabaseClient(): SupabaseClient   // Anonymized read-only client, no session persistence
```

### `data/menu.ts`

```ts
const DEMO_RESTAURANT_MENU: FullMenuData   // Static fallback for dev / offline use

async function getPublicMenuBySlug(slug: string): Promise<FullMenuData | null>
// Uses unstable_cache (Next.js) with revalidate=60s + tags `menu-{slug}`
```

### `data/localStore.ts`

```ts
function getLocalMenu(slug: string): FullMenuData | null
function saveLocalMenu(menu: FullMenuData): void
```

### `gemini/extract.ts`

```ts
interface ImageInput  { base64Data: string; mimeType: string; }
interface GeminiExtractionResult { data: ExtractedMenu; modelUsed: string; }

async function extractMenuFromImages(images: ImageInput[], apiKeyOverride?: string, modelOverride?: string): Promise<GeminiExtractionResult>
function getMockExtractedMenu(): ExtractedMenu
```

### `gemini/prompt.ts`

```ts
const GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT: string   // System instruction for dish/allergen extraction
const GEMINI_RESPONSE_SCHEMA: JSONSchema               // Zod-like schema passed to Gemini as responseSchema
```

### `utils/dishImageCompressor.ts`

```ts
interface CompressionResult { success: boolean; dataUrl?: string; sizeKb?: number; width?: number; height?: number; format?: string; error?: string; }

async function compressDishPhoto(file: File): Promise<CompressionResult>
// Compresses client-side via Canvas → WebP/JPEG, target < 100 KB, max 1200×800
```

---

## Dependency Graph

```
                          types.ts ──────────┐
                              │              │
                  ┌───────────┴──┐           │
                  ▼              ▼           │
           allergens.ts        utils.ts      │
                                          (used everywhere)
                 │
  ┌──────────────┼──────────────────┐
  ▼              ▼                   ▼
ai/index.ts →  gemini/*             data/*
  │                ▲                  │
  └──────▲─────────┘                   │
         │                             │
         ▼                             ▼
   supabase/*                  supabase/*
```

Call chain overview:

1. `extractMenu()` (ai/index.ts) — orchestrator
   - `ai/litert.ts` ← reads `GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT` from `gemini/prompt.ts`
   - `ai/litert_hybrid.ts` ← same prompt, adds reasoning step
   - `ai/local.ts` ← Ollama path, same prompt
   - `gemini/extract.ts` ← uses `GEMINI_MENU_EXTRACTION_SYSTEM_PROMPT` + `GEMINI_RESPONSE_SCHEMA` from `gemini/prompt.ts`, validates against `types.ts` schemas
2. `getPublicMenuBySlug()` (data/menu.ts)
   - Calls `data/localStore.ts` first, then falls back to `supabase/public.ts`
   - Result shape matches `FullMenuData` from `types.ts`
3. Pages/API routes call `createClient()`, `createServerSupabaseClient()`, or `createPublicSupabaseClient()` depending on runtime.

---

## Invariants & Side Effects

### Types & Validation

- **All extracted menus must pass `ExtractedMenuSchema.parse()`** before leaving the AI modules. Schemas preprocess messy LLM output (missing fields, different key names, string prices like `"9.50"` → float `9.5`).
- The `allergens` field on every dish is **always a string array of EU-14 codes** — never free text.

### Environment Variables

| Variable | Used By | Default / Fallback |
|---|---|---|
| `AI_PROVIDER` | ai/index.ts | `"auto"` |
| `OLLAMA_BASE_URL` | ai/local.ts | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | ai/local.ts | `"qwen3-vl:8B"` |
| `LITERT_BASE_URL` | ai/litert.ts | `http://127.0.0.1:11436` |
| `LITERT_MODEL` | ai/litert.ts | `"minicpm-v4.7-1b"` |
| `LITERT_VISION_URL` | ai/litert_hybrid.ts | `http://127.0.0.1:11436` |
| `LITERT_REASONING_URL` | ai/litert_hybrid.ts | `http://127.0.0.1:11435` |
| `GEMINI_API_KEY` | gemini/extract.ts | required for live calls |
| `GEMINI_MODEL` | gemini/extract.ts | cascaded through candidates |
| `NEXT_PUBLIC_SUPABASE_URL` | supabase/* | `https://dummy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase/* | `dummy-key` |

### Side Effects

| Module | Side Effect |
|---|---|
| `data/localStore.saveLocalMenu()` | Writes `data/local_menus.json` to disk (sync `fs.writeFileSync`). |
| `ai/*.ts` | Logs `[AI Engine]` / `[Gemini]` / `[LiteRT *]` messages to stdout/stderr. |
| `data/menu.getPublicMenuBySlug()` | Hits Next.js `unstable_cache` (edge/Data Cache). Tags `menu-{slug}` for selective invalidation (revalidate after 60 s). |
| `gemini/extract.ts` | Sends HTTP POST to `generativelanguage.googleapis.com` with images; iterates over candidate models until one succeeds. May hit rate limits (429). |
| `ai/litert*.ts`, `ai/local.ts` | Sends HTTP POST to local endpoints (`/v1/chat/completions` or `/api/chat`). |
| `utils/dishImageCompressor.ts` | Runs entirely in browser; creates an off-screen Canvas element. No network or disk side effects. |

### Auto-Discovery Protocol (`extractMenu`, provider `"auto"`)

1. Probe LiteRT Vision (:11436) **and** Reasoning (:11435) simultaneously (`AbortSignal.timeout(600)`).
2. If both up → hybrid pipeline (MiniCPM-V OCR → Gemma 4 reasoning).
3. If only vision up → direct LiteRT extraction.
4. Fall back to probing Ollama (:11434).
5. If Ollama up → Ollama extraction.
6. If no local engine, but `GEMINI_API_KEY` configured → cloud Gemini.
7. Final fallback → mock/demo data.

---

## Notes

- **No database migrations belong here.** Supabase schemas are managed at `npx supabase link`.
- **Demo data** lives in `data/menu.ts` as `DEMO_RESTAURANT_MENU` and is used whenever no real Supabase or AI backend is available.
- The entire AI pipeline is designed to be **hot-swappable** via the `provider` option — add a new backend by implementing a function and wiring it into `extractMenu()`.
