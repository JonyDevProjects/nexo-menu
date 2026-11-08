# Nexo Menu — Consolidated Audit Report v2.0

**Date:** 2026-11-08  
**Methodology:** 5 parallel explore agents + EGM brainstorm → draft → 3 goldfish reviews  
**Files generated:** concepts_brief.md, design_draft.md, audit_report.md, review_*.md  

---

## Final Findings — After Goldfish Verification

### P0 Critical (Must Fix Before EPC-02)

| # | Category | Finding | Confidence | Effort |
|---|----------|---------|------------|--------|
| 1 | Data Safety | Non-atomic file writes in localStore.ts (line 46) → data corruption risk | HIGH | 15m |
| 2 | Auth Security | Restaurant upsert has no ownership check (menu.ts:117–131) | MEDIUM-HIGH | 30m |
| 3 | Provider Chain | litert_hybrid returns "litert" → broken UI state | HIGH | 20m |
| 4 | Accessibility | Pinch-to-zoom disabled in viewport (layout.tsx:15) | HIGH | 2m |
| 5 | Code Dup | QR download code duplicated identically across 2 files (~60 lines) | HIGH | 30m |
| 6 | Testing | Zero test automation → CI blind spot | HIGH | 1d (infra setup) |

### P1 High (Fix Before Release)

| # | Category | Finding | Confidence | Effort |
|---|----------|---------|------------|--------|
| 7 | Data Safety | Shallow mutations in MenuEditor (B6-B9) → stale React state | MEDIUM | 2h |
| 8 | AI Pipeline | Cascade timeout can reach ~380s → Vercel serverless timeout | HIGH | 1h |
| 9 | Accessibility | Lightbox & allergen modals lack ARIA dialog semantics | HIGH | 3h |
| 10 | Accessibility | Form inputs missing associated labels | MEDIUM | 2h |
| 11 | Test Infra | Ad-hoc scripts are pseudo-tests (fs.readFileSync + regex includes()) | HIGH | 1d (setup) |
| 12 | Spec Drift | Web Worker claim false — main thread Canvas only | MEDIUM | doc fix |
| 13 | Spec Drift | Skeleton shimmer entirely absent from UI | MEDIUM | 4h |
| 14 | New (GF) | Systemic keyboard trap across ALL modals | HIGH | 3h |
| 15 | New (GF) | LiteRT health check AbortSignal.timeout(600ms) → false negatives | LOW-MED | 15m |

### P2 Medium (Proactive Fixes)

| # | Category | Finding | Details |
|---|----------|---------|---------|
| 16 | Data Safety | Silent error swallowing in localStore | Throw instead of console.warn/error |
| 17 | Data Safety | TOCTOU race existsync/readFileSync | Remove existsSync guard |
| 18 | Mock Data | getMockExtractedMenu() diverges from DEMO_RESTAURANT_MENU | Consolidate to single source |
| 19 | Providers | modelName inconsistency "Gemma 4" vs "Gemma" | Normalize |
| 20 | Accessibility | Toggle buttons don't announce ON/OFF state | Dynamic aria-label |
| 21 | Accessibility | `<html lang>` stays "es" when switched to English | useEffect sync |
| 22 | Accessibility | Warning banner needs role="alert" | Minor addition |
| 23 | Accessibility | Legal checkbox uses alert() instead of aria-invalid | Inline error messages |

### Downgraded by Goldfish (Overstated)

| # | Original Rating | Adjusted | Reason |
|---|----------------|----------|--------|
| B5 (write coalescing) | P1 | P3 | Server actions are single-threaded; concurrent saves impossible |
| B6-B9 (shallow mutations) | P1 | P2 | Inside one component's useState — nothing external holds refs |
| D4 (touch targets) | P1 | P3 | Only ~4/7 elements fail, not all |
| D9 (contrast ratios) | P2 | P4 | Numbers were wrong (12.3:1 and 4.52:1 are fine) |
| D10 (print layout) | P2 | Removed | @media print already exists with @page A5 rules |
| D6 (title-only labels) | P1 | P3 | Most have aria-label; only 2 violations remain |

---

## Consolidated Priority Execution Plan

### Sprint 0: Immediate Fixes (Same Day) — ~2 hours

1. Remove `userScalable: false` from viewport ✅ trivial
2. Fix litert_hybrid provider chain in lib/ai/index.ts ✅ 3 line changes
3. Extract QR downloads to lib/qr-utils.ts ✅ deduplication
4. Set image alt="" inside aria-labeled button ✅ accessibility

### Sprint 1: Data Integrity (Day 1-2) — ~4 hours

5. Atomic write in localStore.ts (temp+rename pattern)
6. Add ownership check on restaurant upsert
7. Replace silent catch with throw + toast notification
8. Remove existsSync guard in ensureLoaded()
9. Deep clone helper for MenuEditor state

### Sprint 2: Test Infrastructure (Day 2-3) — ~8 hours

10. Setup Vitest config + @testing-library/react
11. Write 5 minimum tests: localStore, immutability, auth-boundary, provider-labels, ISR-revalidation
12. Update CI workflow to run `npm test` before deploy

### Sprint 3: AI & Modal Hardening (Day 3-4) — ~4 hours

13. Reduce Gemini per-model timeout to 8s, add global 45s cap
14. Create reusable dialog primitive with role="dialog", Escape handler, focus trap
15. Apply to lightbox + allergen modal + any future modals

### Sprint 4: Accessibility Pass (Day 4-5) — ~3 hours

16. Fix remaining form labels (sr-only labels with htmlFor)
17. Fix toggle button dynamic aria-labels
18. Sync `<html lang>` with language toggle
19. Add warning banner role="alert"
20. Replace alert() with aria-invalid on legal checkbox errors

### Documentation Corrections

21. Correct "73/73 checks PASS" → accurate count
22. Note Web Worker gap as planned improvement, not implemented
23. Mark EPC-02–EPC-04 requirements explicitly as pending in Section 4

---

## Impact Summary

| Metric | Before | Target After Sprint 0 | Target After All Sprints |
|--------|--------|----------------------|-------------------------|
| Test coverage | 0% | Infra ready, 5 critical tests | >60% core modules |
| CI safety gate | Pseudo-tests only | Fails on regression | Blocks broken PRs |
| WCAG AA compliance | F (multiple failures) | C (major issues fixed) | A (passing) |
| Spec accuracy | ~65% | ~80% (doc corrections) | ~95% |
| Duplicate code lines | ~60 | ~0 | ~0 |
| Crash-on-data-loss paths | 2 | 1 (auth ownership remains) | 0 |
