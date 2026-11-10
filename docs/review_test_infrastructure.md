# Goldfish Review: Test Infrastructure Audit Findings

**Reviewer:** Fresh-context audit (no prior knowledge)
**Audit Report:** `audit_report.md` — Category A: Test Infrastructure
**Date:** 2026-11-08

---

## Part 1: Verification of Audit Claims

### Claim 1: "Zero test dependencies in package.json" — ✅ CONFIRMED

Reading `package.json`, the full `devDependencies` block contains exactly these packages:

```json
"devDependencies": {
  "@types/node": "^22.10.2",
  "@types/react": "^19.0.2",
  "@types/react-dom": "^19.0.2",
  "autoprefixer": "^10.6.1",
  "eslint": "^9.16.0",
  "eslint-config-next": "^15.1.0",
  "postcss": "^8.4.49",
  "tailwindcss": "^3.4.17",
  "typescript": "^5.7.2"
}
```

**Result:** Zero test runners, zero testing utilities, zero mocking libraries. Not even `@testing-library/dom` or `jsdom`. This is a greenfield project from a testing perspective.

The `scripts` section defines `test:ci` as a pipeline of `typecheck` + three ad-hoc scripts (`test:rls`, `test:field`, `test:flow`) and standalone targets `test:isr`, `test:flow`, `benchmark:ai`. None invoke `vitest`, `jest`, or `playwright`.

### Claim 2: "No .test files, .spec files, or test framework configs" — ✅ CONFIRMED

Glob searches returned **zero results** for:
- `**/*.test.{ts,tsx,js,jsx}` — none
- `**/*.spec.{ts,tsx,js,jsx}` — none
- `**/vitest.config.*` — none
- `**/jest.config.*` — none
- `**/playwright.config.*` — none
- Root-level `vitest*`, `jest*`, `playwright*` — none

This is **not a partial implementation**. The project has no test infrastructure whatsoever. Every test framework, configuration file, and test source file is absent.

### Claim 3: "Four ad-hoc scripts do static regex checks, not real assertions" — ✅ CONFIRMED (with deeper analysis)

After reading all four scripts end-to-end, here is the actual assessment of each:

#### `scripts/test-supabase-rls.ts` (375 lines)
- **Phase 1:** Reads `supabase/migrations/001_initial_schema.sql` and runs regex checks against table names, foreign keys, RLS enable statements, policy names, and indexes. This validates that migration DDL *contains* certain strings — it never executes SQL against a database.
- **Phase 2 (live):** Only runs if `NEXT_PUBLIC_SUPABASE_URL` does not contain "dummy" or "your-project-id". Since the audit notes dummy fallback credentials are in use, this phase is effectively disabled in CI.
- **Phase 2 (offline/simulated):** The entire `runOfflineSimulatedTests()` function evaluates trivial boolean expressions like `ownerA === ownerB` (hardcoded UUIDs `111...` vs `222...`). These are **tautologies**, not security tests. They always pass because the values are constants.
- **Verdict:** ⚠️ **Deceptive coverage.** Reports 30+ "checks passed" but Phase 2 offline mode guarantees every result is true by construction. The script will **never fail** unless the migration SQL file changes format.

#### `scripts/test-menu-flow.ts` (304 lines)
- Entirely regex-based `fs.readFileSync` checks across 7 source files (`auth.ts`, `menu.ts`, `extract.ts`, `menu.ts/data`, `localStore.ts`, `QrDedicatedView.tsx`, `MenuPublicView.tsx`, `MenuEditor.tsx`, `types.ts`).
- Checks for string presence: `.includes("supabase.co")`, `.includes('userId: "demo-anonymous-user"')`, etc.
- One data-driven check validates `data/local_menus.json` has exactly 8 dishes for a specific restaurant — this is the only check that inspects runtime data state.
- **Verdict:** ⚠️ **Code-smoke tests, not functional tests.** Catches missing function names but cannot verify behavior. Does not execute any component, action, or business logic.

#### `scripts/test-field-pilot.ts` (511 lines)
- Phases 1 & 2: Static checks of `QrDownloadModal.tsx` for A5 IDs, dimensions, print rules, QRCodeSVG usage, canvas sizes — all regex `includes()`.
- Phase 3: TTV SLA simulation uses **hardcoded timing objects** (`timings: { photoUploadAndCompressMs: 1840, ... }`) — completely fabricated numbers. No actual user interaction is measured.
- Phase 4: Static CSS/class checks on `MenuPublicView.tsx` for sticky positioning, language toggle, theme toggle.
- **Verdict:** 🔴 **Worst offender.** 511 lines of effort producing zero actual testing. TTV metrics are fictional constants masquerading as SLA validation. This script inflates the apparent quality score.

#### `scripts/test-isr-cache.ts` (425 lines)
- Reads `vercel.json`, `next.config.ts`, build manifests, prerender manifests, static HTML output, and source files.
- Bundle size measurement **requires `npm run build` first** (auditor noted correctly).
- Most checks remain static: regex on JSON headers, file existence, HTML content presence.
- **Verdict:** ⚠️ Partially useful for pre-deploy gate, but the bundle size check requires a full build (~2-5 minutes). Too slow for PR gating.

### Claim 4: "CI misses test gate" — ✅ CONFIRMED

`.github/workflows/ci.yml` defines two jobs:
1. **quality-gate:** Runs `typecheck → lint → test:rls → test:field → test:flow` — all non-testing static checks. A PR can merge with broken React components, corrupted state mutations, and incorrect AI extraction — none would be caught.
2. **docker-validation:** Docker compose config + image builds. Useful but orthogonal to application correctness.

There is **no `npm test` step** because no test command exists. The CI gate provides type safety and lint compliance, but zero behavioral validation.

### Additional Finding: No mock utilities

Confirmed: zero instances of `msw`, `nock`, `sinon`, `vi.mock` (Vitest), or `jest-mock`. The codebase has no mocking infrastructure. Any future test suite must build mocks from scratch for Supabase clients, filesystem operations, and Next.js server actions.

---

## Part 2: Strategic Assessment

### Question 1: Is Vitest really the best choice vs Jest for Next.js 15 + React 19?

**Verdict: Vitest is the right choice.** Here's why:

| Factor | Vitest | Jest |
|--------|--------|------|
| **ESM native** | Yes — matches `"type": "module"` in project | Requires babel-jest + `experimental-ESM` flag |
| **React 19 JSX transform** | Works out-of-box via esbuild/Vite plugin | Needs `@testing-library/react` v16+ + babel config; known compatibility pain |
| **Next.js 15 app router** | Compatible; works alongside Turbopack/esbuild | Needs `@svgr/webpack` workaround for some asset imports |
| **Startup speed** | ~10-50ms cold start | ~500-2000ms due to Node.js bootstrap overhead |
| **Config complexity** | Minimal `vitest.config.ts` | Extensive `jest.config.js` with transform entries |
| **Testing Library integration** | `@testing-library/jest-dom` works identically | Same |
| **Mocking** | Native `vi.fn()`, `vi.spyOn()` — cleaner API | `jest.fn()`, legacy API baggage |
| **TypeScript support** | Native TS, no additional config | `ts-jest` or `babel-jest`; extra compile step |

**Key point for this project:** Next.js 15 uses the new JSX transform and React 19 drops PropTypes + some legacy hooks. Jest's transformer pipeline is actively losing ground to the Vite/esbuild stack. For a team starting from zero, Vitest reduces cognitive load and config drift risk.

**Recommendation:** Use `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `happy-dom` (for DOM rendering without jsdom complexity). Skip `jest-environment-jsdom` entirely.

---

### Question 2: Minimum Viable Test Set — Exactly 5 Tests to Catch the Most Bugs

Given the P0/P1 findings in the audit, these five tests deliver maximum bug-catching per line written:

#### Test 1: `localStore.test.ts` — Atomic Write & Error Propagation
**Targets:** P0 items B1, B2, B3
```
describe("localStore atomic writes", () => {
  it("must throw on disk-full, not silently swallow", async () => {
    // Mock fs.writeFileSync to throw EIO → assert saveLocalMenu() throws
    // Currently: catch block console.error() → caller sees nothing
  });
  
  it("must not race between existsSync and readFileSync", async () => {
    // Race condition: file deleted between check and read → parse JSON on empty string
    // Currently: ensureLoaded() swallows error on empty content.trim()
  });
});
```
**Why:** `localStore.ts` (51 lines) is the single most dangerous module. Silent failure means UI never knows data was lost. One test preventing silent crash > 10 unit tests.

#### Test 2: `menu-editor-immutability.test.ts` — State Mutation Detection
**Targets:** P1 items B6, B7, B8, B9
```
describe("MenuEditor immutability", () => {
  it("updateDish must not mutate original categories array ref", () => {
    const original = [...menu.categories];
    dispatch(updateDish({ ... }));
    expect(menu.categories).not.toBe(original[0]); // shared ref!
  });
  
  it("removeDish splice must not mutate parent", () => {
    const before = JSON.stringify(menu.categories);
    dispatch(removeDish(id));
    expect(JSON.stringify(menu.categories)).not.toBe(before.slice(0, 20) + "...");
  });
});
```
**Why:** Shallow spread + direct array mutation causes stale state in React 19's concurrent rendering. Users see ghost updates, duplicate dishes, or deleted items reappearing. These bugs are subtle and hard to reproduce manually.

#### Test 3: `server-actions-auth.test.ts` — Auth Identity & Ownership
**Targets:** P1 items B10, B11, B12
```
describe("Server action auth boundaries", () => {
  it("must reject upsertRestaurant without ownership validation", () => {
    // Simulate req.headers["x-supabase-user-id"] = strangerUid
    // Upsert succeeds because hardcoded "demo-anonymous-user" bypasses uid check
  });
  
  it("must distinguish demo-anonymous-user from real auth.uid()", () => {
    // Verify RLS policies reference auth.uid(), not hardcoded string
    // grep for "demo-anonymous-user" → 6 occurrences → all break RLS
  });
});
```
**Why:** Hardcoded `demo-anonymous-user` breaks Supabase RLS entirely. Anyone who discovers a restaurant slug can hijack ownership. This is both a security issue AND a testing concern — the test forces explicit boundary checking.

#### Test 4: `provider-labels.test.ts` — Litert Hybrid Chain Breakage
**Targets:** P0 items C5–C9 (all provider label mismatch points)
```
describe("Provider label round-trip", () => {
  it("must return 'litert_hybrid' through the entire extraction pipeline", () => {
    // Input: provider = "litert_hybrid"
    // lib/ai/index.ts returns { provider: "litert" } ← BUG
    // Assert: final.provider === "litert_hybrid" at each stage
  });
});
```
**Why:** This is a 5-location fix spread across 5 files. A single test covering the entry/exit contract prevents divergence at any one of those locations. Unit tests here are cheaper than QA finding wrong labels in production.

#### Test 5: `ISR-revalidation.test.ts` — Cache Invalidation Correctness
**Targets:** B15 (Supabase client fallback), plus ensures server actions work correctly
```
describe("ISR cache revalidation", () => {
  it("revalidateTag + revalidatePath must both fire after saveMenuAction", () => {
    // Mock Next.js revalidateTag and revalidatePath
    // Trigger saveMenuAction → assert both called with correct slug
    // If either is missing, stale menu renders for users
  });
});
```
**Why:** ISR misconfiguration silently serves outdated menus. This test verifies the dual-revalidation mechanism (tag + path) fires together, which is the only reliable way to purge CDN cache in Next.js 15 app router.

---

### Question 3: Should Playwright Run on Every PR or Only on Request?

**Verdict: Playwright on-request + nightly scheduled run. NOT every PR.**

Justification:

1. **Cost-to-signal ratio is poor.** Playwright spins up real Chromium instances, navigates routes, and simulates user interactions. Each test takes 3-8 seconds. A reasonable set of E2E smoke tests (login → upload photo → AI extract → save → verify published view) totals ~30-60 seconds. On every push to PR, this adds significant CI time.

2. **Environmental brittleness.** E2E tests require either:
   - A live Supabase instance (not available in standard GitHub Actions runner)
   - Docker Compose Supabase emulator (slows CI by 2-3 minutes for init)
   - MSW-intercepted Supabase client (possible but not yet built)
   
   Until infrastructure matures, Playwright tests will flake intermittently — eroding trust in the CI gate.

3. **PR gate should be fast and deterministic.** The recommended PR gate is:
   ```
   npm run typecheck   # 30s
   npm run lint        # 20s
   npm test            # vitest unit tests — 15-30s total
   ```
   Total: under 2 minutes. Developers wait < 2 min per PR.

4. **Nightly Playwright schedule** catches regressions that unit tests miss (routing, navigation, lightbox UX, theme toggle persistence) without blocking developer velocity.

**Recommended schedule:**
- `cron_create` for nightly at 2 AM UTC: Playwright E2E smoke suite
- Manual `/e2e` slash-command trigger (if slash commands supported) or Discord/Slack webhook notification for on-demand runs
- When Playwright stabilizes at 95%+ pass rate over 2 weeks, promote to PR gate

---

### Question 4: Architectural Patterns That Make Testing Harder Than Usual

Several patterns significantly increase test complexity beyond a standard React app:

#### Pattern A: Server Actions (app/actions/*.ts)
Server actions are edge functions — they don't export pure functions. Testing them requires:
- Wrapping in `act()` calls or using `next-actions-test-utils` pattern
- Simulating request context (headers, cookies, Supabase session)
- Cannot be imported and called directly in Node.js test environment without special setup

**Impact:** High. Standard unit test approach (`import { action } from '../actions/menu'; action(...)`) fails because server actions use `async/await` with implicit `request` context.

#### Pattern B: Supabase Client Abstraction Layer
Three distinct client factories exist (`client.ts`, `server.ts`, `public.ts`) with conditional credential injection:
```
lib/supabase/client.ts     → middleware SSR context
lib/supabase/server.ts     → server component context
lib/supabase/public.ts     → cookie-free public access
```
Plus fallback to `dummy.supabase.co` when env vars are missing.

**Impact:** Medium-High. Every test that interacts with data must stub ALL three client factories. No central mock store. Tests become fragile as client interfaces evolve.

**Fix needed:** Create `lib/test/factories.ts` with a `createTestSupabaseClient()` that uses MSW interceptors or localstack-compatible endpoint.

#### Pattern C: localStorage Dependency (localStore.ts)
The entire `lib/data/localStore.ts` uses Node.js `fs` (filesystem), not browser `localStorage`. This is unusual — typically Next.js apps use either browser storage or database. This hybrid approach means:
- Files are written to `process.cwd()/data/local_menus.json`
- Tests running in CI may write to unexpected paths
- File permissions vary across OS (macOS vs Ubuntu runner)

**Impact:** Medium. Tests must isolate filesystem operations via mocking or sandboxed temp directories. Cannot rely on clean-room test execution.

**Fix needed:** Inject filesystem interface as a dependency parameter: `saveLocalMenu(menu, fsInterface?)` instead of importing `fs` directly.

#### Pattern D: Mixed Data Sources (Cloud Supabase ↔ Local JSON ↔ Demo Data)
Data flows through three layers:
```
Production: Supabase Cloud (via RLS policies)
Development: Docker Compose Supabase (localhost:54322)  
Fallback:  lib/data/localStore.ts (JSON files)
          lib/data/menu.ts DEMO_RESTAURANT_MENU constant
```

**Impact:** High. Each layer has different schemas, data states, and failure modes. A test passing against `DEMO_RESTAURANT_MENU` reveals nothing about production behavior. Conversely, requiring live Supabase makes tests slow and unreliable.

**Fix needed:** Test-specific seed data with guaranteed schema alignment. Consider `kysely-drizzle`-style query builder that works uniformly across data sources during tests.

#### Pattern E: Real-time WebSocket Connection
Server actions implicitly depend on Supabase GoTrue for authentication tokens. Without GoTrue running, auth falls back to hardcoded anonymous user — bypassing all authorization.

**Impact:** Medium. Test environment must decide: authenticate against real GoTrue (slow, requires external service) or mock the auth flow (simpler but less realistic).

---

### Question 5: Realistic Timeline — Can We Go from 0% to Useful CI in 1 Week?

**Yes. Partially useful CI in 1 week is achievable.** Here's the realistic breakdown:

| Day | Activity | Expected Outcome |
|-----|----------|------------------|
| **Day 1** | Install vitest + @testing-library/react + happy-dom; create `vitest.config.ts`; scaffold test directory | Config working, `npx vitest run` produces output |
| **Day 2-3** | Write `localStore.test.ts` (6-8 tests) with fs mocking | P0 B1-B3 bugs detectable; CI catches silent failures |
| **Day 4** | Write `immutability.test.ts` (4-5 tests) for MenuEditor state ops | B6-B9 bugs detectable; shallow-spread mutation caught |
| **Day 5** | Write `provider-labels.test.ts` (1 integration test) + `auth-boundary.test.ts` (2 tests) | C5-C9 + B10+B12 detectable |
| **Day 6** | Integrate `npm test` into `.github/workflows/ci.yml`; add to PR check | CI blocks PR merge if any unit test fails |
| **Day 7** | Fix false positives; tune test speed; document test conventions | First stable CI gate goes live |

**Result after 1 week:**
- **Test count:** ~15-20 tests
- **Lines of test code:** ~400-600 LOC
- **Coverage target:** Not percentage-based (misleading for this project); goal is "critical path detection"
- **CI status:** PR blocked on typecheck + lint + vitest unit suite (~45 second total)
- **What's NOT covered after week 1:** Server action behavior with real Supabase, ISR caching, E2E navigation, accessibility validation, performance budgets

**Week 2 extension (optional):** Add Playwright E2E smoke test (login → menu edit → publish → verify public view). Add MSW Supabase mocking for server action tests.

---

## Part 3: Which Non-Test P0/P1 Issues Could Be Prevented by Specific Tests?

| Audit Item | Issue Type | Would a Test Catch It? | What Kind of Test |
|------------|-----------|----------------------|-------------------|
| **B1-B3** (localStore corruption, TOCTOU, silent failure) | Data integrity | **YES** — easily detected | Unit test with fs mocking |
| **B6-B9** (shallow spread + array mutation) | State corruption | **YES** — reference equality checks catch immediately | Unit test comparing before/after refs |
| **B10** ("demo-anonymous-user" hardcoded) | Auth bypass | **PARTIALLY** — test would surface that hardcoded ID ≠ real user, but not a traditional "test" — more of a code scanning rule | Unit + Lint rule |
| **B11** (restaurant upsert no ownership check) | Security | **YES** — test simulating unauthenticated user performing upsert | Integration test with mocked supabase context |
| **C5-C9** (provider label chain) | UX bug | **YES** — round-trip contract test catches mismatch | Integration test: input → process → verify output type |
| **D1** (pinch-to-zoom disabled) | Accessibility | **NO** — needs axe-core / puppeteer-accessibility scan | Playwright + axe-plugin |
| **D2** (lightbox no ARIA dialog) | Accessibility | **NO** — needs visual/accessibility testing tool | Playwright + axe-plugin |
| **C10-C12** (AI cascade timeout) | Performance | **POSSIBLY** — test measuring actual API response times | Integration test with timeout tracking |
| **DRIFT-01** (Web Worker claim false) | Documentation | **NO** — this is spec-to-code drift, not a functional bug | Spec-compliance lint rule |
| **DRIFT-02** (shimmer animation missing) | UX/Spec | **NO** — requires visual diff testing | Visual regression test (Percy/Cypress Visual) |

**Summary:** Approximately **6 of 11 P0/P1 findings** (B1-B3, B6-B9, B10-B11, C5-C9) would be directly preventable by the 5 minimum-viable tests proposed above. The accessibility and spec-drift issues require different testing modalities (axe scans, visual comparison) rather than unit/integration tests.

---

## Part 4: Final Recommendations

### Immediate (Week 1)
1. `npm i -D vitest @testing-library/react @testing-library/jest-dom happy-dom`
2. Create `vitest.config.ts` extending `@vinxi/plugin-react` for React 19 support
3. Scaffold 5 test files (see Section Q2 above)
4. Add `npm test` step to `.github/workflows/ci.yml` in the quality-gate job, AFTER lint but BEFORE docker validation
5. Fix `localStore.ts` atomic write (P0 B1): replace `writeFileSync` with temp-file + `renameFileSync`

### Short-term (Weeks 2-3)
6. Create `lib/test/supabase-mock.ts` using MSW to intercept Supabase REST API calls
7. Add Playwright E2E smoke suite — 5-page max (Home, Login, Editor, Publish, Public View)
8. Schedule nightly Playwright run via cron

### Medium-term (Month 2)
9. Replace `test:*` ad-hoc scripts with proper Vitest test files that reuse the same assertion logic
10. Add `@axe-core/playwright` for automated WCAG AA violation detection in E2E
11. Implement test data factory pattern for consistent fixture generation

### Anti-patterns to Avoid
- **Do NOT** keep the ad-hoc scripts after implementing Vitest — they give false confidence (as verified: `test-field-pilot.ts` with 511 lines of fake TTV data)
- **Do NOT** chase percentage-based coverage targets — aim for "critical path" coverage instead
- **Do NOT** add Playwright before Vitest unit tests are stable — flaky E2E kills team trust
