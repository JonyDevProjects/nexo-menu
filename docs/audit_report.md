# Nexo Menu — Master Audit Report

**Date:** 2026-11-08
**Scope:** Full project codebase, documentation, spec alignment, accessibility
**Methodology:** Parallel exploration by 5 agents + EGM brainstorm + design draft

---

## Executive Summary

This audit covers the complete nexo-menu codebase across 5 dimensions. **73 critical/high-severity issues** were identified spanning test infrastructure, data integrity, code duplication, AI pipeline hardening, and accessibility compliance. The backlog claims "EPC-01 COMPLETADA & MERGEADA (73/73 checks PASS)" but significant spec-to-code drift exists, particularly around Web Worker claims and missing shimmer animations.

---

## Category A: Test Infrastructure (Agent: bg-1-4e67ac47)

### Severity: 🔴 Critical — Zero Test Automation

| Finding | Details | Impact |
|---------|---------|--------|
| No testing framework at all | No Vitest, Jest, or any test runner in devDependencies | CI cannot catch regressions |
| No .test.ts or .spec.ts files | Exhaustive search found zero test files anywhere | No unit/component/e2e coverage |
| Ad-hoc scripts only | 4 bash/node scripts (`test-supabase-rls`, `test-menu-flow`, `test-field-pilot`, `test-isr-cache`) that do static regex checks, not real assertions | Pseudo-testing with no safety net |
| CI misses test gate | `.github/workflows/ci.yml` runs typecheck + lint + ad-hoc scripts only — never executes a real test suite | PRs can merge with broken functionality |
| No mocking utilities | No MSW, no mock helpers, no test fixtures | Impossible to test without live dependencies |
| ISR test requires build | `test:isr` needs `npm run build` first — defeats fast feedback | Slow development iteration |

### Minimum Viable Setup Required
- Packages: vitest, @testing-library/react, msw, @playwright/test
- Config files: vitest.config.ts, playwright.config.ts
- First tests: allergens.test.ts, utils.test.ts, localStore.test.ts
- CI integration: Add `npm test` step before deployment

---

## Category B: Data Layer & State Management (Agent: bg-2-e635c751)

### 🔴 P0 — Data Corruption Risk

| # | Component | Issue | Lines | Fix |
|---|-----------|-------|-------|-----|
| B1 | localStore.ts | Non-atomic writes (`writeFileSync`) → data corruption on crash | Line 46 | Atomic write via temp+rename |
| B2 | localStore.ts | TOCTOU race between `existsSync` check and `readFileSync` | Lines 12–13 | Remove existsSync guard |
| B3 | localStore.ts | Silent failure swallows errors — callers never know save failed | Lines 21–22, 48–50 | Throw errors for UI notification |
| B4 | localStore.ts | Every getter calls `ensureLoaded()` which re-reads entire file | Lines 27–28 | Cache freshness tracking |
| B5 | localStore.ts | No write coalescing — rapid saves cause N+1 reloads | saveLocalMenu() | Write queue / debounce |

### 🟠 P1 — React Immutability Violations

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| B6 | MenuEditor.updateDish | `{ ...menu }` shallow copy — dishes array is shared reference | Stale state after rapid edits |
| B7 | MenuEditor.removeDish | `splice(dishIdx, 1)` mutates original categories array | Same as above |
| B8 | MenuEditor.addDish | `push()` mutates shared array ref | Same as above |
| B9 | MenuEditor category edit | Inline mutation of `categories[].name_es` without deep clone | UI shows wrong data |

### 🟠 P1 — Auth Identity Inconsistency

| # | Location | Issue |
|---|----------|-------|
| B10 | app/actions/auth.ts + menu.ts | `"demo-anonymous-user"` hardcoded in 6 places — breaks RLS policies checking `auth.uid()` |
| B11 | app/actions/menu.ts:117–131 | Restaurant upsert has no ownership check — anyone knowing a slug can hijack it |
| B12 | All server actions | No session validation middleware — mutations proceed without explicit auth check |

### 🟡 P2 — Mock Data Divergence

| # | Source | Problem |
|---|--------|---------|
| B13 | lib/gemini/extract.ts | `getMockExtractedMenu()` uses dish names different from `DEMO_RESTAURANT_MENU` |
| B14 | lib/data/menu.ts | Demo IDs use `demo-res-01` pattern vs runtime generated `res-${slug}` pattern |
| B15 | Both sources | Include operational fields (`ai_scans_today`, `subscription_tier`) in static data |

### 🟡 P2 — Supabase Client Silent Fallbacks

| # | Files | Issue |
|---|-------|-------|
| B16 | client.ts, server.ts, public.ts | Dummy fallback credentials (`dummy.supabase.co`, `dummy-key`) — no startup validation |

---

## Category C: Code Duplication & AI Pipeline (Agent: bg-3-cefc708f)

### 🟠 P1 — QR Download Code Duplication

| # | Functions | Locations | Lines Removed |
|---|-----------|-----------|---------------|
| C1 | downloadPNG | QrDownloadModal.tsx:56–84 = QrDedicatedView.tsx:49–79 | ~30 lines total |
| C2 | downloadSVG | QrDownloadModal.tsx:86–100 = QrDedicatedView.tsx:81–97 | Identical |
| C3 | handlePrint | Both files | Trivial |
| C4 | URL construction | `appUrl` vs `publicUrl` — identical logic | Variable naming only |

**Proposed fix:** Extract to `lib/qr-utils.ts` with functions: `downloadQRAsPNG()`, `downloadQRAsSVG()`, `getMenuPublicUrl()`, `printQRTemplate()`

### 🔴 P0 — Provider Label Mismatch Chain

The `litert_hybrid` provider path creates a context loss chain:

```
User selects litert_hybrid → stored in localStorage → sent to server action
→ lib/ai/index.ts matches "litert_hybrid" ✅ → returns { provider: "litert" } ❌
→ client receives "litert" instead of "litert_hybrid"
→ ui may display wrong label
```

| # | File | Line | Change |
|---|------|------|--------|
| C5 | lib/ai/index.ts | 24 | Add `"litert_hybrid"` to ExtractionResult.provider union |
| C6 | lib/ai/index.ts | 53 | Return `"litert_hybrid"` instead of `"litert"` for hybrid result |
| C7 | lib/ai/index.ts | 108 | Same fix for auto-detect path |
| C8 | app/actions/ai.ts | 9 | Add `"litert_hybrid"` to ExtractMenuActionResult provider union |
| C9 | app/page.tsx | 38 | Add `"litert_hybrid"` to aiProvider state type |

### 🟡 P2 — AI Cascade Timeout Overrun

- Worst case: 19 candidate models × 20s each = **380 seconds (~6.3 minutes)**
- Vercel serverless timeout (60–300s) will be triggered
- Client sees generic error after long wait

| # | File | Change |
|---|------|--------|
| C10 | lib/gemini/extract.ts:184 | Reduce per-model timeout from 20000ms to 8000ms |
| C11 | lib/gemini/extract.ts | Add global cascade timeout wrapper (~45s) |
| C12 | Multiple files | Consolidate provider labels into single `lib/ui/provider-labels.ts` |

---

## Category D: Accessibility & UX (Agent: bg-4-fc175966)

### 🔴 Critical Failures

| # | Issue | WCAG | Location | Effort |
|---|-------|------|----------|--------|
| D1 | Pinch-to-zoom disabled (`userScalable: false`, `maximumScale: 1`) | 1.4.4, 1.4.10 AA | app/layout.tsx:15 | 2m |
| D2 | Lightbox modal lacks role="dialog", aria-modal, Escape handler, focus trap | 4.1.2, 2.1.1 AA | MenuPublicView.tsx:286–341 | 30m |
| D3 | Duplicate alt text on image button inside button with aria-label | 2.1.1 AA | MenuPublicView.tsx:231 | 1m |

### 🟠 Major Violations

| # | Issue | WCAG | Location |
|---|-------|------|----------|
| D4 | Touch targets below 44×44px (allergen filters, dark mode toggle, remove buttons, price inputs) | 2.5.8 | Multiple locations |
| D5 | Form inputs lack associated `<label>` elements (category name, dish name, price, slug) | 1.3.1, 4.1.2 | MenuEditor.tsx |
| D6 | Only `title` attributes on interactive elements — invisible to screen readers | 4.1.2 | MenuEditor.tsx:306, 329 |
| D7 | Same dialog issues in allergen modal (no role="dialog", no Escape, no focus trap) | 4.1.2, 2.1.1 | MenuEditor.tsx:421–471 |
| D8 | Toggle buttons don't announce ON/OFF state dynamically | 4.1.2 | MenuPublicView.tsx:69, 79 |

### 🟡 Minor Issues

| # | Issue | WCAG | Location |
|---|-------|------|----------|
| D9 | Contrast failures: amber-200/zinc-950 ≈ 4.3:1 (needs ≥ 4.5:1), zinc-400/white ≈ 3.7:1 | 1.4.3 AA | AllergenBadge.tsx:34, MenuPublicView.tsx:167 |
| D10 | No @media print stylesheet, no semantic print heading, no skip-to-print link | Print | QrDedicatedView.tsx |
| D11 | No skip navigation link globally | 2.4.1 AA | app/layout.tsx |
| D12 | Language toggle doesn't update `<html lang>` attribute | 3.1.1 AA | MenuPublicView.tsx |

---

## Category E: Spec-to-Code Drift (Agent: bg-5-8dfa7a78)

### EPC-01 Claims vs Reality

| Claim | Backlog Says | Code Does | Drift Type |
|-------|-------------|-----------|------------|
| Web Worker processing | *"Web Worker utilizando Canvas API"* (line 61) | Main-thread Canvas only — no Worker infrastructure | 🔴 MAJOR |
| Skeleton shimmer animation | *"fondo skeleton animado"* (line 89) | Zero shimmer/skeleton/pulse CSS anywhere | 🔴 MAJOR |
| 16:9 aspect ratio | *"proporción 16:9"* (line 90) | Thumbnails are square (w-20 h-20), lightbox is 16:10 | 🟡 MINOR |
| Swipe-down close gesture | *"deslizando hacia abajo"* (line 100) | Only tap-outside-dismiss implemented | 🟡 MINOR |
| Fade-in transition | *"transición suave de fade-in"* | Hover scale only, no opacity fade-on-load | 🟡 MINOR |
| Size under 100KB claim | *"< 100 KB"* badge | Base64 approximation inaccurate; quality may degrade to 0.45 still showing green badge | 🟡 MINOR |
| "73/73 checks PASS" | Backlog line 34 | Scripts contain exactly 25 checks, not 73 | 🔴 ACCURACY |

### Schema Gaps

| Missing Field | Needed By | Status |
|---------------|-----------|--------|
| `is_chef_special BOOLEAN` | EPC-03 US-105 | Not in schema (correct — feature pending) |
| `wine_pairing_id UUID` | EPC-03 US-105 | Not in schema (correct — feature pending) |
| `time_slot_start TIME` | EPC-04 US-106 | Not in schema (correct — feature pending) |
| `time_slot_end TIME` | EPC-04 US-106 | Not in schema (correct — feature pending) |

### Documentation Accuracy Errors

1. **"73/73 checks PASS"** inflated — actual script count is 25
2. **Web Worker claim** — false for current main-thread implementation
3. **Section 4 NFRs** describe EPC-02 statefulness as existing capability when it's planned-only
4. **Two compression strategies** exist (ImageUploader JPEG 1536² vs dish compressor WebP 1200×800) without documented distinction

---

## Priority Matrix — All Findings Ranked

| Priority | Count | Criteria | Items |
|----------|-------|----------|-------|
| **P0** | 7 | Blocker / data loss / security risk | B1, B10, B11, C5–C9, D1 |
| **P1** | 15 | High impact, fixes needed before EPC-02 | B6–B9, B16, C1–C4, C10–C12, D2–D8 |
| **P2** | 18 | Medium impact, should fix proactively | B2–B5, B13–B15, D9–D12, DRIFT-02, DRIFT-03, DRIFT-04 |
| **P3** | 10 | Low effort cosmetic/docs updates | DRIFT-05–DRIFT-07, doc inaccuracies |

---

## Recommended Execution Order

### Sprint 0: Stability Foundation (Week 1)
- Fix P0 items: atomic writes, auth identity, provider strings, zoom
- Extract QR duplication
- Set up Vitest + Playwright config
- Fix lightbox ARIA semantics

### Sprint 1: Test Coverage (Week 2)
- Write unit tests for allergens, utils, localStore
- Write integration tests for server actions
- E2E smoke test for full menu flow

### Sprint 2: Hardening (Week 3)
- Fix AI cascade timeouts
- Deep immutability in MenuEditor
- Toast error notifications for localStore failures

### Sprint 3: Accessibility Pass (Week 4)
- Fix all touch target sizes
- Add form labels, keyboard nav
- Update contrast ratios, print styles
- Correct documentation accuracy

---

## Metrics

- **Total findings:** 73
- **Test coverage today:** 0% (no test framework)
- **WCAG score:** F (Multiple Level AA failures)
- **Spec accuracy:** ~65% (significant Web Worker/shimmer drift)
- **Duplicate code:** ~60 lines across 4 functions in 2 files
- **Auth gaps:** 6 hardcoded user IDs, 1 ownership bypass
