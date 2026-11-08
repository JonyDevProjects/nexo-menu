# Admin Components

Components in this directory power the restaurant owner's admin workflow — uploading menu photos, configuring AI inference providers, and editing/drafting extracted menu data before publishing.

---

## Components

### 1. `AiProgressStepper`

**File:** `AiProgressStepper.tsx`

#### Purpose

Displays a visually animated multi-step progress indicator during AI-powered menu digitization (Gemini Flash processing). It gives the user real-time feedback on what the AI is doing, cycling through four sequential phases.

#### Props Interface

```typescript
interface AiProgressStepperProps {
  isProcessing: boolean; // When false, component renders nothing (early return)
}
```

#### State Management Patterns

- **Internal step state**: Uses `useState(0)` to track the current processing step index (0–3).
- **Controlled lifecycle via prop**: A `useEffect` listens to `isProcessing`; when it becomes `true`, staggered timers advance the stepper through steps at 700ms, 1500ms, and 2200ms intervals. When `isProcessing` flips back to `false`, the step resets to 0.
- **Cleanup**: All three `setTimeout` handles are cleared on every `isProcessing` change to prevent stale timer callbacks.

#### Side Effects

- None beyond DOM rendering. No API calls, no localStorage interactions, no side channels.

#### Dependencies

| Dependency                              | Kind      | Notes                                               |
| --------------------------------------- | --------- | --------------------------------------------------- |
| `lucide-react`                          | External  | `Check`, `Loader2`, `Sparkles` icons                |
| `react` (`useEffect`, `useState`)       | Built-in  | Core React hooks                                    |

#### Known Issues / TODOs

- Hardcoded timing values (700ms, 1500ms, 2200ms) may not match actual Gemini processing time, potentially causing the UI to show "done" before processing completes. These should be driven by an external completion signal rather than fixed delays.
- The Spanish-language status messages are hardcoded into JSX. Consider extracting to localization strings for easier internationalization.

---

### 2. `ImageUploader`

**File:** `ImageUploader.tsx`

#### Purpose

Provides a touch-friendly, drag-and-drop-style photo upload area for capturing or selecting images of physical menus. Images are client-compressed (resized + JPEG-re-encoded) before being passed up to a parent component. Supports up to 3 simultaneous uploads per default configuration. Designed for mobile-first use with camera capture support.

#### Props Interface

```typescript
interface CompressedImage {
  id: string;          // Unique key: `${Date.now()}-${i}-${random}`
  dataUrl: string;     // Compressed base64 JPEG string
  file: File;          // Original File object reference
  previewUrl: string;  // Object URL for thumbnail display
}

interface ImageUploaderProps {
  onImagesReady: (images: CompressedImage[]) => void; // Callback to notify parent
  maxImages?: number;            // Maximum allowed images (default: 3)
  isLoading?: boolean;           // Disables interaction while loading
}
```

Also exports the `CompressedImage` interface for upstream consumers.

#### State Management Patterns

- **Local image collection**: `useState<CompressedImage[]>([])` manages the active queue.
- **Per-image metadata**: Each entry stores both the original `File` and the compressed `dataUrl` for reuse.
- **Error state**: Single `errorMsg` string state, cleared on each new upload attempt.
- **No external persistence**: State is purely local and ephemeral — resets on re-mount.

#### Side Effects

| Effect                          | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| Canvas-based compression        | Resizes images to max 1536×1536 and re-encodes as JPEG at 82% quality using an inline `<canvas>` element. |
| `URL.createObjectURL`           | Creates temporary blob URLs for thumbnail previews. Memory leaks prevented by browser garbage collection once component unmounts or images are removed. |
| File reader                     | Reads uploaded files as Data URLs via `FileReader.readAsDataURL`. |
| Validation                      | Rejects non-image MIME types silently; blocks uploads exceeding `maxImages`. |

#### Dependencies

| Dependency                              | Kind      | Notes                                     |
| --------------------------------------- | --------- | ----------------------------------------- |
| `@/components/ui/Button`               | Internal  | Reusable `Button` component               |
| `lucide-react`                          | External  | `Camera`, `Upload`, `X`, `AlertCircle`    |
| `react`                                 | Built-in  | `useRef`, `useState`                      |

#### Known Issues / TODOs

- **Memory management**: `URL.createObjectURL` results are never explicitly revoked when images are removed via `removeImage()`. Over multiple upload/removal cycles, this can accumulate detached blob memory.
- **Canvas error path**: If `getContext("2d")` returns null (very rare edge case), the function falls back to the raw uncompressed source. This inconsistency could lead to unexpectedly large uploads.
- The error message is in Spanish ("Puedes subir un máximo de…"), making it non-localizable without refactoring.

---

### 3. `InferenceControlPanel`

**File:** `InferenceControlPanel.tsx`

#### Purpose

An expandable/collapsible configuration panel that lets restaurant owners select and configure their AI inference engine. Supports five provider modes: Auto-detection, Google Gemini Cloud, Ollama Local, LiteRT Hybrid (local vision + reasoning), and Mock/Demo simulation. Shows live provider health statuses and provides inline input fields for API keys, model names, server URLs, etc.

#### Props Interface

```typescript
export type AiProviderType = "auto" | "gemini" | "litert_hybrid" | "local" | "mock";

export interface InferenceConfig {
  provider: AiProviderType;
  geminiApiKey: string;
  geminiModel?: string;              // e.g., "gemini-flash-lite-latest", "auto"
  ollamaBaseUrl: string;             // e.g., "http://localhost:11434"
  ollamaModel: string;               // e.g., "qwen3-vl:8b"
  litertVisionUrl: string;           // e.g., "http://localhost:8080/vision"
  litertReasoningUrl: string;        // e.g., "http://localhost:8080/reasoning"
}

interface InferenceControlPanelProps {
  config: InferenceConfig;           // Current config (read-only from parent perspective)
  onChangeConfig: (newConfig: InferenceConfig) => void; // Controlled update callback
  isProcessing?: boolean;            // Disables certain actions during processing
}
```

Also exports `AiProviderType` union and `InferenceConfig` interface.

#### State Management Patterns

- **Controlled config pattern**: Parent owns the canonical config; child communicates changes via `onChangeConfig`. No internal mutation of the config object.
- **Local UI state**:
  - `isOpen`: Collapsible panel toggle (boolean).
  - `providerStatuses`: `Record<string, ProviderStatus>` — populated by `checkAiProvidersAction()` on mount.
  - `isChecking`: Loading indicator spin for health checks.
  - `showApiKey`: Password visibility toggle for the Gemini API key field.

#### Side Effects

| Effect                          | Description                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| `localStorage` reads            | On mount, restores `nexo_gemini_api_key`, `nexo_gemini_model`, and `nexo_ai_provider` from localStorage if not present in props. |
| `localStorage` writes           | Every provider change (`nexo_ai_provider`), API key change (`nexo_gemini_api_key`), and model change (`nexo_gemini_model`) persists to localStorage immediately. |
| Server action call              | Calls `checkAiProvidersAction()` (a Next.js Server Action from `@/app/actions/ai`) to probe availability of Gemini, Ollama, and LiteRT endpoints. Updates `providerStatuses` accordingly. |

#### Dependencies

| Dependency                                        | Kind         | Notes                                              |
| ------------------------------------------------- | ------------ | -------------------------------------------------- |
| `@/components/ui/Button`                          | Internal     | Button primitives                                  |
| `@/app/actions/ai`                                | Internal     | `checkAiProvidersAction`, `ProviderStatus` type    |
| `lucide-react`                                    | External     | ~15 icon imports including `Cpu`, `Cloud`, `Server`, `Sparkles`, etc. |
| `react`                                           | Built-in     | `useState`, `useEffect`                            |

#### Known Issues / TODOs

- **ESLint suppression**: `useEffect` has `// eslint-disable-next-line react-hooks/exhaustive-deps` which removes `onChangeConfig` from dependency array intentionally, but this creates a subtle closure staleness risk if `onChangeConfig` identity changes.
- **Uncontrolled localStorage fallback**: On initial mount, if config doesn't include a Gemini key but localStorage does, the component auto-updates config via `onChangeConfig`. Since `onChangeConfig` isn't in the deps array, this works only on first render — subsequent prop updates won't re-apply localStorage restore.
- **Secret exposure concern**: API keys stored in `localStorage` are readable by any JavaScript running on the page. Consider encrypted storage or httpOnly cookie alternatives for production.
- Provider badge labels and descriptions contain marketing copy and version-specific details (e.g., "Qwen3-VL:8B") that will need updating if underlying models change.

---

### 4. `MenuEditor`

**File:** `MenuEditor.tsx`

#### Purpose

The primary CRUD editor for the AI-extracted restaurant menu. Allows editing restaurant metadata (name, slug, description), editing individual dish entries (name, description, price), adding/removing dishes, managing allergen annotations (with a modal picker for the full EU 14-allergen list), uploading/compressing dish photos, and confirming legal compliance before saving/publishing.

#### Props Interface

```typescript
interface MenuEditorProps {
  initialMenu: ExtractedMenu;   // Starting data shape from lib/types
  onSave: (payload: {
    restaurantName: string;
    slug: string;
    description: string;
    menu: ExtractedMenu;
    legalConfirmed: boolean;
  }) => Promise<void>;          // Async save handler returned from parent
  isSaving?: boolean;           // Loading/disabled state for the save button
  provider?: "local" | "litert" | "gemini" | "mock";   // Display hint
  modelName?: string;           // AI model name for display
}
```

#### State Management Patterns

- **Full local copy of menu tree**: `useState<ExtractedMenu>(initialMenu)` creates a mutable clone. All edits manipulate nested objects within this state without deep-cloning entire structures.
- **Immutability via shallow copies**: Update operations like `updateDish()` produce `{ ...menu }` with targeted nested replacements — a semi-deep copy pattern. Not full immutable but sufficient for flat-ish category/dish structures.
- **Separate scalar states**: `restaurantName`, `slug`, `description`, `legalConfirmed` tracked independently.
- **Modal state**: `activeAllergenModal` holds `{ catIdx, dishIdx } | null` to gate the allergen selector overlay.
- **Compression tracker**: `compressingDishKey: string | null` tracks which dish cell is currently compressing to disable its upload button.
- **Error map**: `photoError: { [key: string]: string }` maps `${catIdx}-${dishIdx}` → error message.

#### Side Effects

| Effect                                   | Description                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Client-side image compression            | `handleDishPhotoUpload` calls `compressDishPhoto(file)` from `@/lib/utils/dishImageCompressor` which uses canvas/WebP to reduce dish photos under 100KB. |
| Form validation                          | Prevents save if `legalConfirmed` checkbox is unchecked (client-side alert). |
| Slug sanitization                        | `handleSlugChange` normalizes text to lowercase kebab-case via regex. |

#### Dependencies

| Dependency                                                    | Kind        | Notes                                                       |
| ------------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `@/lib/types`                                                 | Internal    | `ExtractedMenu`, `ExtractedCategory`, `ExtractedDish`       |
| `@/lib/allergens`                                             | Internal    | `EU_ALLERGENS` constant                                     |
| `@/components/ui/AllergenBadge`                               | Internal    | Per-dish allergen pill display                              |
| `@/components/ui/Button`                                      | Internal    | Primary action and secondary buttons                        |
| `@/lib/utils/dishImageCompressor`                             | Internal    | `compressDishPhoto(file)` client-side compressor            |
| `lucide-react`                                                | External    | ~10 icons: Plus, Trash2, ShieldCheck, Check, Sparkles, etc. |
| `react`                                                       | Built-in    | `useState`                                                  |

#### Known Issues / TODOs

- **Shallow-copy immutability bug**: `updateDish` uses `{ ...menu }` which creates a shallow copy of the top-level `menu` object. Modifying `updated.categories[catIdx].dishes[dishIdx]` correctly replaces the dish, but if future schema changes add deeply-nested mutable arrays (e.g., modifying an existing allergens array in-place elsewhere), bugs could arise. Recommended: use a proper immutable update library or deep-spread pattern.
- **Legal check uses `alert()`**: Blocking legal confirmation via native browser `alert()` is jarring. Should be replaced with a custom modal or inline banner.
- **No optimistic rollback**: If `onSave` throws after the legal check passes, there's no automatic rollback of local edits. Consider wrapping saves in transactional patterns.
- The allergen modal is always mounted in the DOM (hidden when `activeAllergenModal === null`). For accessibility and performance, consider lazy-rendering.
- Spanish-language strings throughout UI (placeholders, labels, alerts) — needs i18n extraction.

---

## Cross-Cutting Concerns

| Concern                 | Details                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| **Dark Mode Support**   | All components use Tailwind `dark:` prefixes consistently for CSS variables and color tokens.    |
| **Internationalization** | Currently all visible text is hardcoded in Spanish. No i18n framework detected.                  |
| **Accessibility (a11y)** | Basic `aria-label` attributes present on close/remove buttons. Missing role attributes on modals.|
| **Mobile-First**        | Touch-optimized tap targets, responsive grids, and `capture="environment"` on file inputs.      |
| **Print Styles**         | None applied in admin components (print styles exist in QR components instead).                 |
