# Nexo Menu — Stability Sprint Design Document

*   **Author:** Command Code + Nexo-Tech-Lead
*   **Status:** Draft
*   **Date:** 2026-11-08

## Overview

This document addresses critical quality gaps identified after merging EPC-01 (WebP dish photos). The project is functionally usable but lacks automated testing, has silent failure paths in data persistence, contains code duplication, and has accessibility issues. This sprint focuses on stabilizing the codebase before implementing EPC-02 features (comanda + bill splitting).

## The Problem

Nexo Menu has reached a state where functional features are working but the foundation is fragile:

1. No test automation exists — CI only runs typechecking and static scripts. If someone changes a component, there is no way to verify nothing broke except manual testing.
2. Data loss can occur silently when local file writes fail (`localStore.ts` catches errors and returns stale cached data with no notification).
3. Copy-paste patterns exist across QR components, creating maintenance burden.
4. Mock data diverges between two files serving different purposes, leading to confusion during development.
5. Accessibility issues (pinch-to-zoom disabled, lightbox dismissal too aggressive) create friction for users with disabilities.
6. AI pipeline timeout aggregation can reach 4+ minutes with no progress indication.

These are not blockers today but compound risk as the codebase grows toward EPC-02–EPC-04 features.

## Goals

- Add Vitest for unit/integration tests covering: data layer (types validation, menu CRUD), Supabase client wrappers, utility functions (cn(), formatPrice()), and core business logic (allergen map).
- Add Playwright for e2e smoke tests covering: full menu creation flow (upload → AI extract → save → public view), and QR generation.
- Fix `localStore.ts` race conditions and add error propagation with retry logic.
- Implement deep immutability for MenuEditor state updates.
- Extract duplicate QR download code into shared utility.
- Align mock data sources; consolidate into single source of truth.
- Remove `userScalable: false` from viewport configuration.
- Improve lightbox dismissal UX to require explicit close or swipe-down gesture.
- Add progressive timeout with cancellation tokens for AI model cascade.

## Non-Goals

- Implementing EPC-02 (comanda carrito + bill splitting). This is scoped out of this sprint.
- Replacing Zustand with a global state manager. State management decisions come later.
- Refactoring all auth flows. Only fix the hardcoded `demo-anonymous-user` inconsistency.
- Adding dark mode fixes beyond what already exists.
- Performance optimization beyond the AI pipeline improvements listed above.

## Open Questions

1. **Test infrastructure location**: Should test files live alongside source files (`.test.ts`) or in a separate `tests/` directory? Mixed approaches exist — some teams colocate, others segregate.
2. **CI test execution**: Should Playwright e2e tests run on every PR? They add ~5 minutes to CI time. Can be gated behind `// @playwright-e2e` comment annotation if needed.
3. **Mock data consolidation**: Should we merge both demo datasets into one canonical mock file and derive specific mocks from it, or keep them separate with explicit cross-reference documentation?

## Critical User Journeys (CUJs)

### CUJ 1: Restaurant Owner Creates a Menu Without Losing Data

*   **Given**: Docker environment running with Supabase disabled (local mode).
*   **When**: Owner uploads dish images, selects AI provider, processes extraction, edits results, saves.
*   **Then**: Menu is persisted to `data/local_menus.json` with atomic write (temp file + rename). Any disk failure produces a visible toast error. On next load, stale cache is detected and reload attempted once.

### CUJ 2: Diner Scans QR, Views Menu, Interacts

*   **Given**: Restaurant at `/m/bar-pepe`, diner scans QR code on tablet.
*   **When**: Diner filters by allergen, opens dish lightbox, swipes down to dismiss.
*   **Then**: Menu renders within 60s ISR window. Lightbox requires deliberate gesture to close. Pinch-to-zoom works. Touch targets meet 44x44px minimum.

### CUJ 3: Automated Test Catches a Regression

*   **Given**: Developer modifies `lib/data/menu.ts` and changes dish structure.
*   **When**: Developer runs `npm test` locally or CI triggers on push.
*   **Then**: Failing Zod schema validation test exits non-zero. CI blocks merge. Developer sees exact assertion failure.

## Technical Plan (Architecture)

### Test Infrastructure

```
nexo-menu/
├── tests/                          # NEW: Top-level test directory
│   ├── unit/                       # Vitest unit tests
│   │   ├── types.test.ts           # Zod schema validation
│   │   ├── utils.test.ts           # cn(), formatPrice()
│   │   ├── allergens.test.ts       # Allergen map coverage
│   │   └── supabase-clients.test.ts # Client wrapper behavior
│   ├── integration/                # Vitest integration tests
│   │   ├── localstore.test.ts      # Race conditions, atomic writes
│   │   ├── actions.test.ts         # Server action contracts
│   │   └── ai-cascade.test.ts      # Timeout, error handling
│   ├── e2e/                        # Playwright e2e
│   │   ├── menu-flow.spec.ts       # Full create → save → view
│   │   ├── qr-flow.spec.ts         # QR generate → download
│   │   └── fixtures/               # Test fixtures, sample data
│   ├── vitest.config.ts            # Vitest config
│   └── playwright.config.ts        # Playwright config
├── package.json                    # Add: vitest, @testing-library/react, @playwright/test
```

**Rationale**: Separate `tests/` directory keeps source clean and makes CI simpler (no test file scanning conflicts). Mixes colocated `.test.ts` for simple utilities and separated for complex integration/e2e.

### Data Layer Fixes

#### localStore.ts — Atomic Writes & Race Conditions

```typescript
// Current pattern (broken):
async function saveLocalMenu(menu) {
  try {
    fs.writeFileSync(file, JSON.stringify(menu)); // Not atomic
  } catch { /* silently swallowed */ }
}

// Proposed pattern:
const store = new Map<string, ParsedMenu>();
let loading = false;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (store.size > 0 && !loading) return;
  if (loadPromise) return loadPromise;
  
  loading = true;
  loadPromise = (async () => {
    try {
      const raw = await fs.readFile(file, 'utf-8');
      if (raw) Object.assign(store, JSON.parse(raw));
    } catch (err) {
      throw new FileSystemError('Failed to load local menus', err);
    } finally {
      loading = false;
      loadPromise = null;
    }
  })();
  
  return loadPromise;
}

async function saveLocalMenu(slug: string, menu: FullMenuData): Promise<void> {
  await ensureLoaded();
  
  // Atomic write: temp file + rename
  const tmpPath = `${file}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(getSnapshot()));
  await fs.rename(tmpPath, file); // Atomic on POSIX + NTFS
  
  updateMap(slug, serialize(menu));
  pendingFlush?.();
}
```

#### MenuEditor — Deep Immutability

Replace shallow spread with structural sharing via immer-like immutable update:

```typescript
// Current (shallow):
const updated = { ...menu };
updated.categories[catIdx].dishes[dishIdx] = { ...dish, field: value };
setMenu(updated);

// Proposed (proper immutable):
const copy = structuredClone(menu);
copy.categories[catIdx].dishes[dishIdx][field] = value;
setMenu(copy);
```

For simple cases `structuredClone()` is sufficient. For complex nested mutations that happen frequently, evaluate `immer` (~2KB gzipped).

### Duplicate Code Extraction

Extract QR download helpers into `lib/qr-utils.ts`:

```typescript
export function downloadPNG(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function downloadSVG(svgString: string, filename: string): Promise<void> {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
```

Delete duplicate implementations in `QrDownloadModal.tsx` and `QrDedicatedView.tsx`, import the shared versions.

### Mock Data Consolidation

Create `tests/fixtures/demo-menus.ts` as canonical source:

```typescript
import type { FullMenuData, ExtractedMenu } from '@/lib/types';

export const CANONICAL_DEMO_MENU: FullMenuData = { /* merged dataset */ };

export function getDemoMenuData(): FullMenuData { return CANONICAL_DEMO_MENU; }
export function getMockExtractedMenu(): ExtractedMenu { 
  return convertToExtractedFormat(CANONICAL_DEMO_MENU); 
}
```

Both `lib/data/menu.ts` and `lib/gemini/extract.ts` import from this file. Conversion helper handles type differences.

### AI Pipeline Hardening

Add progressive timeout and cancellation:

```typescript
// lib/ai/index.ts — orchestrator changes
type ModelAttempt = { model: string; timeoutMs: number; priority: number };

async function extractWithCascadingTimeout(
  images: File[],
  attempts: ModelAttempt[]
): Promise<ExtractedMenu> {
  const controller = new AbortController();
  const { signal } = controller;
  
  // Report progress for each attempt
  const progressReporter = createProgressTracker(attempts.length);
  
  for (const attempt of attempts) {
    if (signal.aborted) break;
    
    progressReporter.start(attempt.model);
    
    try {
      const result = await callModel(attempt.model, images, {
        signal,
        timeout: attempt.timeoutMs
      });
      controller.abort(); // Cancel remaining attempts
      return result;
    } catch (err) {
      progressReporter.fail(attempt.model);
      // Don't abort — continue to next model
      await sleep(500); // Brief pause between retries
    }
  }
  
  throw new CascadeExhaustionError('All models failed');
}
```

### Accessibility Fixes

1. **Remove `userScalable: false`** from `app/layout.tsx` viewport:
   ```typescript
   export const viewport: Viewport = {
     width: 'device-width',
     initialScale: 1,
     // userScalable removed — allow pinch-to-zoom
   };
   ```

2. **Lightbox dismissal**: Replace "tap anywhere" with explicit close button + swipe-down gesture detection using pointer events.

3. **Contrast audit**: Run `axe-core` in Playwright test for WCAG AA compliance on `/m/[slug]` page.

### Provider Label Fix

Fix label mapping in `InferenceControlPanel.tsx` and `page.tsx`:

```typescript
const getButtonProviderLabel = (provider: string): string => {
  const labels: Record<string, string> = {
    gemini: 'Gemini Flash',
    ollama: 'Ollama (Qwen)',
    litert: 'LiteRT',
    litert_hybrid: 'LiteRT Híbrido',  // ADD THIS
  };
  return labels[provider] ?? 'IA Inteligente';
};
```

Update `lib/ai/litert_hybrid.ts` to return `provider: 'litert_hybrid'` instead of `provider: 'litert'`.

## Alternatives Considered

### Alternative A: Colocated `.test.ts` files everywhere

*   **Pros**: Simplest setup, no new directory structure, editor auto-discovers tests.
*   **Cons**: Clutters production directories, harder to exclude from bundle analysis, CI needs glob exclusion.
*   **Reason for Rejection**: For a project this size, separate `tests/` keeps source dirs clean and avoids any future bundler confusion.

### Alternative B: Jest instead of Vitest

*   **Pros**: Larger ecosystem, more mature mocking, familiar to more developers.
*   **Cons**: Slower startup, heavier, Next.js 15 support requires additional config.
*   **Reason for Rejection**: Vitest is faster, better TypeScript support, native ESM, and integrates cleaner with Next.js 15. Benchmarks show 3-5x faster startup.

### Alternative C: Deep immutability via Immer vs structuredClone

*   **Pros (Immer)**: Fine-grained mutation tracking, minimal allocations, best performance for frequent updates.
*   **Cons (Immer)**: Adds dependency, learning curve, proxy-based API differs from standard JS patterns.
*   **Decision**: Start with `structuredClone()` for simplicity. Profile MenuEditor edit frequency — if >10 edits/second causes jank, switch to Immer.

## Non-Functional Requirements

### Security & Privacy
- Test fixtures must never contain real API keys or credentials.
- Playwright e2e tests run against mocked API endpoints (not real Supabase/Gemini).

### Performance & Latency
- Vitest suite should complete in <30 seconds on CI.
- Playwright e2e suite should complete in <5 minutes.
- No test code should increase production bundle (use Vite's `server.requires` exclusion or proper tree-shaking).

### Rollout & Rollback
- All test infrastructure additions are additive — removing them requires deleting `tests/` directory and reverting package.json. No behavioral risk.
- Feature flags not needed for stability fixes — they affect existing behavior, not add new features.

## Detailed Implementation Plan

### Phase 1: Test Infrastructure Setup (Day 1-2)

#### Target Files to Create

**1. `tests/vitest.config.ts`** (Create)
*   Type: Vitest config
*   Configures globals, test environment (jsdom), alias resolution matching tsconfig `@/*`.

**2. `tests/playwright.config.ts`** (Create)
*   Type: Playwright config
*   Webkit/Firefox/Chromium browsers, base URL `http://localhost:3000`, timeouts.

**3. `package.json`** (Modify)
*   Add devDependencies: `vitest`, `@testing-library/jest-dom`, `@testing-library/react`, `@playwright/test`, `msw` (mock service worker).
*   Add scripts: `test`, `test:watch`, `test:e2e`, `test:e2e:ui`, `test:ci` (extend current script to include vitest).

#### Target Files to Modify

**4. `package.json`** (Modify)
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:ci": "tsc && vitest run && playwright test"
  },
  "devDependencies": {
    "vitest": "^2.x",
    "@testing-library/jest-dom": "^6.x",
    "@testing-library/react": "^16.x",
    "@playwright/test": "^1.x",
    "msw": "^2.x"
  }
}
```

### Phase 2: Unit Tests (Day 2-3)

#### Target Files to Create

**5. `tests/unit/types.test.ts`** (Create)
- Test Zod schemas accept valid data, reject invalid data.
- Cover all field types, nullable fields, array edge cases.

**6. `tests/unit/utils.test.ts`** (Create)
- Test `cn()` produces correct class strings with duplicates handled.
- Test `formatPrice()` with various decimal values, locale considerations.

**7. `tests/unit/allergens.test.ts`** (Create)
- Test allergen map covers all 14 EU allergens.
- Test `getRequiredAllergenIds()` returns correct subset for common dietary restrictions.
- Test allergen ID consistency between types and definitions.

**8. `tests/unit/supabase-clients.test.ts`** (Create)
- Test browser client initializes without crash.
- Test server client properly forwards cookies.
- Test public client has no session persistence.

### Phase 3: Integration Tests (Day 3-4)

**9. `tests/integration/localstore.test.ts`** (Create)
- Test atomic write (temp file + rename).
- Test concurrent read/write doesn't corrupt data.
- Test error propagation when file write fails.
- Test cache invalidation after save.

**10. `tests/integration/actions.test.ts`** (Create)
- Test `ensureAnonymousSessionAction()` returns valid session or fallback ID.
- Test `saveMenuAction()` validates input via Zod before writing.
- Test `extractMenuAction()` rejects empty image arrays.

**11. `tests/integration/ai-cascade.test.ts`** (Create)
- Test cascade progresses through models in order.
- Test timeout enforcement per model.
- Test graceful failure when all models exhaust.
- Test recovery on transient network error (retry once).

### Phase 4: E2E Tests (Day 4-5)

**12. `tests/e2e/menu-flow.spec.ts`** (Create)
- Navigate to `/`, upload image, select provider, trigger AI extraction.
- Verify extracted data appears in editor.
- Save menu → verify redirect to public view.
- Verify menu content matches editor edits.

**13. `tests/e2e/qr-flow.spec.ts`** (Create)
- From public view, open QR download modal.
- Verify PNG download initiates correctly.
- Verify SVG download initiates correctly.
- Verify dedicated QR page renders print layout.

### Phase 5: Code Fixes (Day 5-6)

**14. `lib/data/localStore.ts`** (Modify)
- Implement atomic writes with temp file + rename.
- Add concurrent request deduplication.
- Throw errors instead of swallowing them.
- Add visibility error callback for UI toast integration.

**15. `components/admin/MenuEditor.tsx`** (Modify)
- Replace shallow spread with `structuredClone()` for state updates.
- Add immutable update pattern for dish/category modifications.

**16. `lib/qr-utils.ts`** (Create)
- Extract `downloadPNG()` and `downloadSVG()` from both Qr components.

**17. `components/admin/QrDownloadModal.tsx`** (Modify)
- Import and use `lib/qr-utils.ts` instead of local implementations.

**18. `components/qr/QrDedicatedView.tsx`** (Modify)
- Import and use `lib/qr-utils.ts` instead of local implementations.

**19. `tests/fixtures/demo-menus.ts`** (Create)
- Canonical demo menu dataset.
- Export helper functions for FullMenuData and ExtractedMenu formats.

**20. `lib/data/menu.ts`** (Modify)
- Import from `tests/fixtures/demo-menus.ts`.

**21. `lib/gemini/extract.ts`** (Modify)
- Import from `tests/fixtures/demo-menus.ts`.

**22. `app/layout.tsx`** (Modify)
- Remove `userScalable: false` from viewport export.

**23. `components/menu/MenuPublicView.tsx`** (Modify)
- Implement swipe-down gesture for lightbox dismissal.
- Remove tap-anywhere dismissal overlay.

**24. `components/admin/InferenceControlPanel.tsx`** (Modify)
- Update provider label mapping to include `litert_hybrid`.

**25. `lib/ai/litert_hybrid.ts`** (Modify)
- Return `provider: 'litert_hybrid'` instead of `provider: 'litert'`.

**26. `lib/ai/index.ts`** (Modify)
- Add progressive timeout with cancellation tokens.
- Add progress reporting hooks.

**27. `docs/backlog_v1.1.md`** (Modify)
- Add "Stability Sprint" milestone entry.

**28. `docs/especificacion_backlog_v1.1.md`** (Modify)
- Add technical specs for stability improvements.

## Verification Plan

### Compilation/Build
- `npm run typecheck` passes (existing script)
- `npm run build` succeeds with zero warnings

### Unit Tests
- `npm test` runs all Vitest tests
- Target: ≥80% branch coverage on core modules (types, utils, allergens)
- Target: 100% coverage on utility functions (pure functions)

### Integration Tests
- `npm test -- tests/integration/` passes
- All Supabase clients tested against mock server
- Local store tested against real filesystem

### E2E Tests
- `npm run test:e2e` completes successfully
- Covers: menu creation flow, QR generation, public menu rendering

### Static Analysis
- `npm run lint` continues to pass (already configured)
- New test files follow same lint rules

### Accessibility
- `npm run test:e2e -- -g "accessibility"` runs axe-core scan on `/m/[slug]`
- Target: 0 violations at WCAG AA level

---

*Drafted with EGM*
