# Nexo Menu Audit — Concepts Brief

## Working Hypothesis

Nexo Menu is a production-ready SaaS digital menu platform for restaurants. EPC-01 (WebP dish photos) is merged and working. The next phase must address quality gaps that prevent scaling: zero test automation, silent data-loss paths, copy-paste duplication, incomplete feature flags (EPC-02–EPC-04), and performance inefficiencies.

## Identified Issues (Prioritized by Risk × Effort)

### P0 — Data Safety & Reliability

1. **Silent filesystem failures in localStore.ts**
   - Disk write errors caught silently. If disk fills or permissions change, data loss occurs with no notification.
   - Race condition: multiple requests before file load re-read independently.

2. **Shallow state mutation in MenuEditor**
   - Only does shallow copies (`{ ...menu }`). Shared references between set calls violate React immutability best practices. Works by luck, not design.

### P1 — Missing Quality Infrastructure

3. **Zero automated testing**
   - No Jest/Vitest config, no .test files, no mocking framework. Only manual bash/node scripts exist as smoke tests.
   - CI runs typecheck + static scripts — nothing actually asserts code behavior.

4. **No e2e or integration tests**
   - Auth flow, Supabase writes, AI extraction pipeline — none tested programmatically.

### P2 — Code Quality & Duplication

5. **Duplicate download code** (QrDownloadModal.tsx + QrDedicatedView.tsx)
   - PNG/SVG export functions copied identically. One change = two locations to update.

6. **Mock data divergence**
   - DEMO_RESTAURANT_MENU in lib/data/menu.ts diverges from getMockExtractedMenu() in lib/gemini/extract.ts. Different dish names, missing fields.

7. **Provider label mismatch**
   - InferenceControlPanel shows "LiteRT Híbrido" but getButtonProviderLabel doesn't handle litert_hybrid. index.ts returns provider "litert" for hybrid result, confusing UI reporting.

### P3 — Feature Completeness

8. **Auth: hardcoded demo-anonymous-user**
   - Inconsistency: some auth paths use literal string, others may generate different IDs. No logout mechanism exists. Email linking has no verification check.

9. **EPC-02 (Comanda + Bill Splitting) fully pending**
   - Spec written, no implementation. Backlog v1.1 has complete BDD scenarios but zero code.

10. **Image count inconsistency**
    - ImageUploader defaults maxImages=3 but AI action allows 4 images (images.length > 4 check). UX allows 4, uploader blocks at 3.

### P4 — Accessibility & UX

11. **userScalable: false in viewport**
    - Prevents pinch-to-zoom. Bad for accessibility. Users with visual impairments cannot zoom.

12. **Lightbox dismissible area too large**
    - Entire viewport is tap-dismissable. Accidental taps close the lightbox.

### P5 — Performance

13. **AI model cascade has no timeout aggregation awareness**
    - Each model attempt uses 20s timeout. Worst case: 20s x 12+ models = 4 minutes with no progress feedback.

14. **No Suspense boundaries or streaming**
    - Heavy components (editor) load entirely client-side. No partial rendering.

15. **ISR cache creates closures repeatedly**
    - No stale-while-revalidate pattern. Cache is either fresh or missing.

## Proposed Improvement Areas (Epics)

| Epic | Scope | Effort | Value |
|------|-------|--------|-------|
| QA Foundation | Add Vitest + Playwright, test critical paths | Med | Very High |
| Data Integrity Fix | Fix localStore race conditions, deep immutability | Low | High |
| Dedup & Refactor | Extract shared utilities, fix mock divergence | Low | Medium |
| Accessibility Pass | Remove userScalable:false, fix lightbox dismissal, contrast audit | Low | High |
| EPC-02 Implementation | Comanda carrito + bill splitting (per spec) | High | High |
| AI Pipeline Hardening | Timeout orchestration, progress feedback, error messages | Med | Medium |
| State Management Audit | Replace prop drilling where applicable, add Zustand | Med | Medium |

## Decision Required

Should we tackle P0–P3 fixes first as a "stability sprint" before implementing EPC-02 features? Or implement EPC-02 alongside fixes?
