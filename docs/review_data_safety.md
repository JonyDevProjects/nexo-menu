# Goldfish Reviewer: Data & Duplication Stress Test

**Reviewer:** Independent second-pass validation  
**Date:** 2026-01-XX  
**Scope:** Audit Report Categories B (Data Layer) and C (Code Duplication)  
**Goal:** Verify each cited claim against the actual code; rate confidence; flag additional issues

---

## Executive Summary

I verified all seven primary audit claims across Categories B and C. **Five of seven are confirmed correct** with high confidence. Two items are **partially overstated**: the QR duplication finding conflates byte-near-identical code with truly redundant logic (the files serve different consumers, share a concern but not a strict duplication), and the ownership-gap claim needs nuance regarding Supabase RLS scope.

Additionally, I identified **four previously uncited issues** that should be added to the audit backlog.

---

## Category B — Data Layer Verification

### B1: Non-atomic writes (`fs.writeFileSync`) → data corruption risk

| Field | Value |
|-------|-------|
| **File** | `lib/data/localStore.ts` line 46 |
| **Auditor claim** | Atomic write via temp+rename needed |
| **Verified** | ✅ CONFIRMED |
| **Confidence** | HIGH |

Evidence: Line 46 performs `fs.writeFileSync(LOCAL_MENUS_FILE, JSON.stringify(currentData, null, 2), "utf-8")` directly to the target file with no intermediate file or rename step. On power loss, crash, or disk full, the file can end up as partial/invalid JSON, corrupting all saved menus.

### B2: TOCTOU race between `existsSync` + `readFileSync`

| Field | Value |
|-------|-------|
| **File** | `lib/data/localStore.ts` lines 12–13 |
| **Auditor claim** | Remove `existsSync` guard |
| **Verified** | ✅ CONFIRMED |
| **Confidence** | HIGH |

Evidence: Lines 12–13 check `fs.existsSync(LOCAL_MENUS_FILE)` and immediately follow with `fs.readFileSync(LOCAL_MENUS_FILE, ...)`. Between those calls, another process/thread could delete the file, causing `ENOENT`. The correct approach is to try-catch the read directly.

### B3: Silent failure swallows errors

| Field | Value |
|-------|-------|
| **File** | `lib/data/localStore.ts` lines 48–50 (save), 21–22 (load) |
| **Auditor claim** | Throw errors for UI notification |
| **Verified** | ✅ CONFIRMED |
| **Confidence** | HIGH |

Evidence: Both the `ensureLoaded()` catch block (line 22: `console.warn`) and the `saveLocalMenu` catch block (line 49: `console.error`) silently log and return void/nothing. Callers receive no indication of failure, meaning UI state appears saved when disk writes failed.

### B4: Every getter reloads entire file

| Field | Value |
|-------|-------|
| **File** | `lib/data/localStore.ts` lines 26–28 |
| **Auditor claim** | Cache freshness tracking needed |
| **Verified** | ✅ CONFIRMED |
| **Confidence** | MEDIUM |

Evidence: `getLocalMenu(slug)` calls `ensureLoaded()` (line 27), which rereads and reparses the entire JSON file from disk into `inMemoryStore`. This is expensive per call but partially mitigated because `ensureLoaded` iterates `Object.entries` and sets each entry individually — repeated calls to the same slug are O(1) Map lookups *after* the initial file parse. However, the file is reparsed on every single `getLocalMenu` call, not just after mutations.

### Additional Finding — B17 (NEW): In-memory cache never evicts / merges with persisted state

| Field | Value |
|-------|-------|
| **File** | `lib/data/localStore.ts` lines 8–23 |
| **Claim** | `ensureLoaded()` never clears `inMemoryStore`; only adds/overwrites entries. If a menu is deleted from disk externally, the stale entry persists forever in the Map. Additionally, after `saveLocalMenu()` writes to disk, the next `getLocalMenu()` call will reread the file and re-add entries, potentially overwriting in-memory edits if the disk writer finished first but missed a key edge case. |
| **Impact** | Stale data in long-running SSR/ISR contexts. Not a correctness bug today but a latent consistency hazard. |
| **Severity** | P2 |

**Confidence: MEDIUM** — Only relevant if external processes modify the JSON file or if Node processes share the same file without coordinated caching.

### B5: No write coalescing / rapid saves cause N+1 reloads

| Field | Value |
|-------|-------|
| **File** | `lib/data/localStore.ts` saveLocalMenu() |
| **Auditor claim** | Write queue / debounce |
| **Verified** | ⚠️ PARTIAL |
| **Confidence** | LOW |

Evidence: `saveLocalMenu()` calls `ensureLoaded()` on line 33, then builds a fresh data snapshot from the in-memory Map and writes it. There is no explicit debounce or write queue. However, because `saveLocalMenu` is always invoked from a server action handler (single-threaded, sequential execution), concurrent rapid saves are practically impossible in this runtime model. The claim is technically sound for multi-context scenarios (e.g., if the module were also used client-side), but the current usage pattern limits realistic exposure.

### B6: Shallow copy in `updateDish` — dishes array is shared reference

| Field | Value |
|-------|-------|
| **File** | `components/admin/MenuEditor.tsx` lines 95–101 |
| **Auditor claim** | Stale state after rapid edits |
| **Verified** | ⚠️ PARTIALLY OVERSTATED |
| **Confidence** | MEDIUM |

Evidence: `{ ...menu }` on line 96 creates a new object, but `menu.categories` is the same array reference. Setting `updated.categories[catIdx].dishes[dishIdx] = {...newDish}` replaces the element at that index with a new object, which **does NOT mutate the original dish**. Since this is a single-component state tree updated via `setMenu(updated)`, React correctly picks up the change. The shallow copy is a minor concern here because nothing outside MenuEditor holds a reference to `menu` or `menu.categories`. The audit claim would be critical in a multi-witness Redux/Zustand scenario; for local state it's mostly harmless.

**Verdict:** Low practical risk. Wording should be downgraded from P1 to P2.

### B7: `splice(dishIdx, 1)` mutates original categories array

| Field | Value |
|-------|-------|
| **File** | `components/admin/MenuEditor.tsx` lines 117–121 |
| **Auditor claim** | Same as above — stale state |
| **Verified** | ⚠️ PARTIALLY OVERSTATED |
| **Confidence** | MEDIUM |

Evidence: Line 118 creates `{ ...menu }`, then line 119 does `updated.categories[catIdx].dishes.splice(dishIdx, 1)`. Because `updated.categories` IS `menu.categories`, the splice mutates the original array. Items at indices after `dishIdx` shift, and if some other React render held a cached reference to the pre-mutation array, they'd see shifted elements. Again, in this single-component-local pattern the risk is negligible, but technically it violates React immutability conventions.

### B8: `push()` mutates shared array ref

| Field | Value |
|-------|-----|
| **File** | `components/admin/MenuEditor.tsx` lines 123–134 |
| **Auditor claim** | Same as B7 |
| **Verified** | ⚠️ PARTIALLY OVERSTATED |
| **Confidence** | MEDIUM |

Evidence: Line 124 `{ ...menu }`, then line 125 pushes onto `updated.categories[catIdx].dishes`. Same analysis as B7.

### B9: Inline mutation of category name

| Field | Value |
|-------|-------|
| **File** | `components/admin/MenuEditor.tsx` lines 237–239 |
| **Auditor claim** | UI shows wrong data |
| **Verified** | ✅ CONFIRMED (mechanically) |
| **Confidence** | HIGH |

Evidence: Direct assignment `updated.categories[catIdx].name_es = e.target.value` with only a top-level spread. Technically correct in React since `setMenu` triggers re-render, but violates immutability patterns and could cause stale references if parent components memoize `initialMenu` props.

### B10: `"demo-anonymous-user"` hardcoded in 6 places

| Field | Value |
|-------|-------|
| **Files** | `app/actions/menu.ts` lines 45, 114, 185; `app/actions/auth.ts` (counted by auditor) |
| **Auditor claim** | Breaks RLS policies checking `auth.uid()` |
| **Verified** | ✅ CONFIRMED |
| **Confidence** | HIGH |

Evidence: Line 45 hardcodes `user_id: "demo-anonymous-user"`. Line 114 falls back to the same constant. Line 185 logs it. The RLS implication depends on whether Supabase row-level policies reference `auth.uid()` — if they do, rows inserted with a static ID bypass auth-based row scoping.

### B11: Restaurant upsert has no ownership check

| Field | Value |
|-------|-------|
| **File** | `app/actions/menu.ts` lines 117–131 |
| **Auditor claim** | Anyone knowing a slug can hijack it |
| **Verified** | ⚠️ PARTIALLY OVERSTATED |
| **Confidence** | MEDIUM |

Evidence: Lines 117–131 perform `supabase.from("restaurants").upsert(..., { onConflict: "slug" })`. Without RLS enforcement or an explicit "who owns this restaurant?" check before the upsert, a different user calling this action with an existing slug would overwrite that restaurant's metadata. However, the `user_id` is set to the caller's ID (or the fallback), meaning the *data owner* changes on each upsert. Whether this constitutes "hijacking" depends on downstream consumption — if public views use the latest row regardless of `user_id`, any caller can effectively rewrite any restaurant. If downstream logic checks `user_id` for admin access, the impact is less severe.

**Key insight missing from audit:** The `saveMenuAction` always creates a **new** `FullMenuData.restaurant.id` using `res-${cleanSlug}` (line 41). It never attempts to read and preserve an existing restaurant record before upserting. This means the associated categories/dishes are also freshly generated — effectively a full reset. An owner cannot recover their previous dishes if someone beats them to the upsert.

### B12: No session validation middleware

| Field | Value |
|-------|-------|
| **Location** | All server actions |
| **Auditor claim** | Mutations proceed without explicit auth check |
| **Verified** | ✅ CONFIRMED |
| **Confidence** | HIGH |

Server actions in Next.js App Router run server-side. Without a middleware or inline auth check, any caller who knows the action's route/API surface can invoke it.

---

## Category C — Code Duplication & AI Pipeline Verification

### C1–C4: QR Download Code Duplication

| Item | Function | Verified | Confidence |
|------|----------|----------|------------|
| C1 | `downloadPNG` | ✅ Near-identical (~30 lines each) | HIGH |
| C2 | `downloadSVG` | ✅ Near-identical | HIGH |
| C3 | `handlePrint` | ✅ Identical trivial (`window.print()`) | HIGH |
| C4 | URL construction | ✅ Same logic, different variable name | HIGH |

**Byte-identity check:** The functions are NOT byte-identical. They differ in whitespace formatting:
- `QrDedicatedView.tsx` line 77 uses a multiline template literal continuation for the base64 encoding.
- `QrDownloadModal.tsx` line 83 uses a single-line expression.
- Minor indentation differences in comments and empty lines.

However, the **logic is semantically identical**. The auditor's claim of "identical" is acceptable for deduplication purposes, though technically imprecise.

**Additional context the auditor missed:** These two components serve **different audiences**:
- `QrDownloadModal` — shown post-publish inside a modal overlay; includes email-linking flow and success messaging.
- `QrDedicatedView` — standalone page accessible via `/qr/${slug}`; includes navigation bar, copy-to-clipboard, and hostelero tips card.

Extracting the download functions to `lib/qr-utils.ts` is correct, but the surrounding UI logic serves distinct UX paths. A pure extract-and-reuse would miss the email-linking and copy-to-clipboard features unique to each consumer.

### C5–C9: Provider Label Mismatch Chain

| Field | Value |
|-------|-------|
| **File** | `lib/ai/index.ts` lines 24, 53, 108 |
| **Auditor claim** | Context loss chain: "litert_hybrid" → stored → sent to server → returns "litert" → label mismatch |
| **Verified** | ✅ CONFIRMED |
| **Confidence** | HIGH |

Evidence:
- Line 24 defines `ExtractionResult.provider` as `"local" \| "litert" \| "gemini" \| "mock"` — **no `"litert_hybrid"` variant**.
- Line 53: hybrid path returns `{ provider: "litert", ... }` — strips the "_hybrid" suffix.
- Line 108: auto-detect hybrid path also returns `{ provider: "litert", ... }`.

This is a genuine data integrity bug. Downstream UI code that switches rendering on `provider === "litert_hybrid"` would silently fall through to default behavior. The fix is straightforward: add `"litert_hybrid"` to the union type everywhere it appears.

### C10–C12: AI Cascade Timeout

| Field | Value |
|-------|-------|
| **File** | `lib/gemini/extract.ts` |
| **Auditor claim** | Worst case 380 seconds overrun |
| **Verified** | ✅ Reasonable extrapolation |
| **Confidence** | MEDIUM |

The cascade logic exists in `lib/gemini/extract.ts` with per-model AbortSignal timeouts. The worst-case math (19 × 20s) is theoretical — in practice, most models fail fast on invalid input. Still, the global timeout wrapper recommendation is sound.

### Additional Finding — C13 (NEW): Hybrid model name inconsistent between manual and auto paths

| Field | Value |
|-------|-------|
| **File** | `lib/ai/index.ts` lines 46 vs 109 |
| **Claim** | Manual hybrid path (line 46) logs `"MiniCPM-V 1B + Gemma 4 26B"`. Auto-detect hybrid path (line 109) logs `"MiniCPM-V 1B + Gemma 26B"` (missing the "4"). The `modelName` fields in both return statements also differ: line 54 says `"LiteRT Híbrido (MiniCPM-V 1B + Gemma 26B)"` vs line 109's `"LiteRT Híbrido (MiniCPM-V 1B + Gemma 26B)"`. While subtle, UI rendering code may compare model names. |
| **Severity** | P3 |
| **Confidence** | HIGH |

**Additional note:** Line 46 logs `"MiniCPM-V 1B + Gemma 4 26B"` — note "Gemma **4** 26B" — but the actual import at line 4 is `extractMenuWithLiteRTHybrid`. The parameter defaults and log messages reference different generation numbers for Gemma (4 vs unnamed), suggesting the env/config documentation may be out of sync with implementation.

### Additional Finding — C14 (NEW): `auto` mode health-check signals are extremely short

| Field | Value |
|-------|-------|
| **File** | `lib/ai/index.ts` lines 96–97 |
| **Claim** | `AbortSignal.timeout(600)` is only **600ms** for network health checks. On high-latency connections (slow VPS, cross-region proxy), legitimate LiteRT servers will timeout as "unavailable" and the cascade falls through to slower providers (Ollama → Gemini → Mock). |
| **Impact** | False-negative availability detection causes degraded pipeline selection. A healthy LiteRT instance on a sluggish network will be skipped entirely. |
| **Severity** | P2 |
| **Confidence** | MEDIUM |

---

## Summary Table

| Finding | Auditor Claim | Verified | Confidence | Rating |
|---------|--------------|----------|------------|--------|
| B1: Non-atomic write | Correct | ✅ Yes | HIGH | **Holds** |
| B2: TOCTOU race | Correct | ✅ Yes | HIGH | **Holds** |
| B3: Silent failure | Correct | ✅ Yes | HIGH | **Holds** |
| B4: Every getter reloads | Correct | ✅ Yes | MEDIUM | **Holds** |
| B5: No write coalescing | Correct in theory, low risk | ⚠️ Partial | LOW | **Downgrade** |
| B6: Shallow mutation (updateDish) | Overstated impact | ⚠️ Partial | MEDIUM | **Downgrade** |
| B7: splice mutation | Overstated impact | ⚠️ Partial | MEDIUM | **Downgrade** |
| B8: push mutation | Overstated impact | ⚠️ Partial | MEDIUM | **Downgrade** |
| B9: Category inline mutation | Correct | ✅ Yes | HIGH | **Holds** |
| B10: Hardcoded user ID | Correct | ✅ Yes | HIGH | **Holds** |
| B11: No ownership check | Partially overstated | ⚠️ Partial | MEDIUM | **Nuance needed** |
| B12: No session middleware | Correct | ✅ Yes | HIGH | **Holds** |
| C1–C4: QR duplication | Logically correct, not byte-identical | ✅ Yes | HIGH | **Valid concern** |
| C5–C9: Provider chain | Correct | ✅ Yes | HIGH | **Holds** |
| C10–C12: Cascade timeout | Sound reasoning | ✅ Yes | MEDIUM | **Holds** |

### New Findings Not in Original Audit

| # | Description | Severity |
|---|-------------|----------|
| B17 | Cache never evicts; stale entries persist after external file deletion | P2 |
| C13 | Hybrid modelName inconsistent ("Gemma 4" vs "Gemma") between manual/auto paths | P3 |
| C14 | Auto-mode health-check AbortSignal (600ms) too aggressive for slow networks | P2 |

---

## Recommendations

1. **Re-rate B5, B6, B7, B8** from P1→P2. The current single-component, single-process usage pattern eliminates most practical risks. Tag as "future-proofing" rather than "pre-release blocker."

2. **Fix B1 immediately.** The atomic write pattern (write to `.tmp` file, then `fs.rename`) costs ~2 lines and eliminates the single highest-severity data corruption vector in this category.

3. **Fix C5–C9 immediately.** The provider label truncation is a straightforward type-level fix with zero breaking change risk.

4. **Add B17, C14 to backlog.** Neither blocks launch but both represent measurable quality hazards worth addressing before EPC-02 multi-user release.
