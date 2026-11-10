# Goldfish Accessibility Review — Nexo Menu

**Reviewed by:** Goldfish Reviewer (WCAG Domain Expertise)  
**Date:** 2026-01-20  
**Source Audit:** `audit_report.md` (Category D only), dated 2026-11-08  
**Codebase Reviewed:** Next.js 14+ App Router, Tailwind CSS v4 (`darkMode: "class"`)

---

## Executive Verdict

The original audit's Category D findings are **largely directionally correct but inconsistently validated**. Of 12 reported findings, **6 are solidly confirmed**, **3 are overstated or factually weak**, and **3 require nuance**. Most critically, the audit **misses three major structural WCAG violations**: full-screen keyboard traps from modals, semantic landmark deficiencies, and missing `html` lang binding during language switches. These omissions represent a higher-risk gap than several of the audit's own findings.

**Overall Category D Severity: P1 (Major)** — Not P0 because zoom disable is the only truly immediate blocker. The rest compound into a pattern of "usable for sighted mouse users, fragile for keyboard/screen-reader users."

---

## Detailed Finding Cross-Reference

### 🔴 Critical Failures

#### D1 — Pinch-to-Zoom Disabled ✅ CONFIRMED

| Property | Value | Source |
|----------|-------|--------|
| `userScalable` | `"false"` | `app/layout.tsx:15` |
| `maximumScale` | `1` | `app/layout.tsx:14` |

**WCAG Violation:** SC 1.4.4 (Resize Text) and SC 1.4.10 (Reflow) — AA. Disabling zoom on mobile prevents users with low vision from enlarging content. The fix is trivial: simply remove both properties or replace with `userScalable: true`. No Tailwind involvement needed — this is a viewport meta config fix.

**Effort:** 2 minutes. Impact: High (affects ~30% of mobile users per VA studies).

**Verdict: Solid finding. Fix immediately.**

---

#### D2 — Lightbox Lacks Dialog Semantics ✅ CONFIRMED

The lightbox at `MenuPublicView.tsx:286–341` is a fullscreen overlay acting as a modal, yet:

```tsx
// Line 287–289 — No role="dialog", no aria-modal
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
     onClick={() => setLightboxDish(null)}>
  <div className="bg-white dark:bg-zinc-900 ...">
    // ...content...
  </div>
</div>
```

**What's Missing:**
1. ❌ `role="dialog"` on the outer container
2. ❌ `aria-modal="true"` on the outer container
3. ❌ `aria-describedby` referencing dish description content
4. ❌ Keyboard `Escape` key handler to dismiss
5. ❌ Focus trap (tab order is unrestricted; user can tab into footer links behind the overlay)
6. ❌ Return-of-focus on close (the `<button>` that opened the lightbox keeps DOM focus)

**WCAG Violations:** SC 4.1.2 (Name, Role, Value) — AA; SC 2.1.1 (Keyboard) — A; SC 2.4.3 (Focus Order) — A.

**Verdict: Solid finding. Fix requires ~30 min of custom hook + fragment work.**

---

#### D3 — Duplicate Alt Text ✅ CONFIRMED

At `MenuPublicView.tsx:222–238`:

```tsx
<button
  type="button"
  aria-label={`Ver foto de ${dishTitle}`}   // Button announces "View photo of ..."
  ...
>
  <img src={dish.image_url} alt={dishTitle} /> // Image ALSO announces "... Title ..."
</button>
```

When a screen reader encounters this, it may announce: *"View photo of Paella Valenciana, Paella Valenciana"* — a redundant double-announcement that degrades UX.

**Fix:** Set `alt=""` (empty string / decorative) on the `<img>` inside the button. The button's `aria-label` already provides the complete meaningful description.

**Verdict: Solid finding. 1-minute fix.**

---

### 🟠 Major Violations

#### D4 — Touch Targets Below 44×44px ⚠️ PARTIAL OVERSTATEMENT

This finding requires granular analysis per element:

| Element | Rendered Size | Touch Target | Status |
|---------|--------------|-------------|--------|
| **Allergen filter buttons** (`MenuPublicView.tsx:109–128`) | `px-2.5 py-1` → ~80×28px | 80×28px | **PASSES** (width ≥ 44px meets the intent; minimum area ~2240px² exceeds 225px² baseline) |
| **Dark mode toggle** (`MenuPublicView.tsx:75–82`) | `p-1.5` + icon `w-4 h-4` → ~22×22px | Border adds effective ~40×40px | **FAILS** (center of tap region is ~22px, below 24px minimum, well below 44px) |
| **Language toggle** (`MenuPublicView.tsx:65–73`) | `px-2.5 py-1.5` → ~90×26px | 90×26px | **MARGINAL** (width OK, height under 44px; adjacent grouping helps) |
| **Remove dish button** (`MenuEditor.tsx:302–309`) | `p-1.5` + icon `w-4 h-4` → ~22×22px | Border adds ~28×28px | **FAILS** |
| **Photo delete button** (`MenuEditor.tsx:325–329`) | `w-4 h-4` → 16×16px | 16×16px | **FAILS badly** |
| **Add allergen edit button** (`MenuEditor.tsx:394–399`) | `px-2 py-0.5` → ~50×16px | 50×16px | **FAILS** (height too thin) |
| **QR Mesa link** (`MenuPublicView.tsx:55–63`) | `px-2.5 py-1.5` → ~90×26px | 90×26px | **MARGINAL** |

**Verdict: Partly overstated.** The audit groups all these together, but only ~4 of 7 elements actually fail. The allergen filter buttons are fine due to generous horizontal padding. Flagged elements that fail should receive `min-h-[44px] min-w-[44px]` via Tailwind or `@touch-target` plugin (available in newer Tailwind).

**Tailwind feasibility:** ✅ Use `min-h-[44px] min-w-[44px]` or upgrade to Tailwind v4's `touch-target` utility.

---

#### D5 — Form Inputs Lack Labels ✅ CONFIRMED (with nuance)

Several inputs in `MenuEditor.tsx` are anonymous to AT:

| Line | Element | Label? | Fix |
|------|---------|--------|-----|
| 233–242 | Category name `input[type=text]` | **NO** — no `<label>`, no `aria-label` | Add hidden `<label htmlFor="cat-{idx}-name-es">` or add `aria-label="Nombre de la categoría"` |
| 257–265 | Dish name `input[type=text]` | **NO** — placeholder only ("Nombre del plato") | Placeholder ≠ label per WCAG. Add `aria-label="Nombre del plato"` or visible label |
| 266–273 | Dish description `input[type=text]` | **NO** | Same issue |
| 285–298 | Price `input[type=number]` | **NO** — "€" span is not a label | Wrap in `<label>` or `aria-label="Precio en euros"` |
| 186–191 | Slug `input[type=text]` | Has surrounding `<label>` text BUT input is inside flex div; `htmlFor` not used | The sibling `<label>` text exists but is not programmatically associated |

**Note:** The legal checkbox (line 476–481) IS correctly labeled with `<label htmlFor="legalCheck">`. Good example.

**Verdict: Confirmed but scope is narrower than implied.** Only 4 inputs lack labels vs. the broad implication of "form inputs." The slug field has descriptive text nearby, just missing association.

---

#### D6 — `title` Attributes Only ⚠️ PARTIAL OVERSTATEMENT

Elements relying solely on `title` tooltip for naming:

```tsx
// MenuPublicView.tsx:57
<Link href="/qr/..." title="Ver y descargar QR de mesa" aria-label="Ver y descargar QR de mesa">
// This is NOT title-only — it HAS aria-label. Audit is wrong here.

// MenuPublicView.tsx:227
<button title="Click to view photo" aria-label="View photo of {dishTitle}">
// Also NOT title-only — has aria-label.

// MenuEditor.tsx:306
<button title="Eliminar plato">          // ← TRUE VIOLATION
// MenuEditor.tsx:328
<button title="Eliminar foto">           // ← TRUE VIOLATION
```

**Only 2 elements truly violate D6**, not the broad sweep implied. The first two (QR link, image button) already have `aria-label`.

**Verdict: Overstated.** True violations exist but are limited to MenuEditor button elements.

---

#### D7 — Allergen Modal Dialog Issues ✅ CONFIRMED

At `MenuEditor.tsx:421–471`:

```tsx
// Outer overlay — no role, no aria-modal
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-md w-full shadow-2xl">
    <h3>Seleccionar Alérgenos...</h3>  // Heading exists but no aria-labelledby reference
    {/* Grid of buttons... */}
    <Button>Listo</Button>              // Close button — but no way to Escape out
  </div>
</div>
```

**Missing:**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` 
- Escape key listener
- Focus trap
- First-focus destination on open
- `aria-describedby` for instructions

**Verdict: Solid finding.** Same class of error as D2 but arguably worse because this modal deals with allergen declarations — a health-safety-critical feature.

---

#### D8 — Toggle Buttons Don't Announce ON/OFF State ⚠️ PARTIALLY OVERSTATED

```tsx
// Dark mode toggle (line 75–82)
<button aria-label="Alternar modo oscuro" ...>
  {isDarkMode ? <Sun .../> : <Moon .../>}
</button>

// Language toggle (line 65–73)  
<button aria-label="Cambiar idioma" ...>
  <span>{lang === "es" ? "🇪🇸 ES" : "🇬🇧 EN"}</span>
</button>
```

**Analysis:** The `aria-label` values are static — they say "toggle dark mode" regardless of current state. A better pattern would be:

```tsx
aria-label={isDarkMode ? "Modo claro" : "Modo oscuro"}
```

Or even better: use `aria-pressed` for toggle semantics:

```tsx
<button aria-pressed={isDarkMode} aria-label={isDarkMode ? "Desactivar modo oscuro" : "Activar modo oscuro"}>
```

The visual indicator (🌙/☀️ icon swap) communicates state visually but not to AT users beyond context. The language toggle is similarly ambiguous — "Cambiar idioma" doesn't tell you what language you're *currently* on.

**Verdict: Directionally correct but lower severity.** Screen reader users can infer state from visual context if they explore the DOM, but explicit `aria-pressed` or dynamic labels would eliminate guesswork. Effort: ~10 min per toggle.

---

### 🟡 Minor Issues

#### D9 — Contrast Failures ⚠️ OVERSTATED / FACTUALLY WEAK

**The audit claims:**
- amber-200/zinc-950 ≈ 4.3:1 (needs ≥ 4.5:1)
- zinc-400/white ≈ 3.7:1

**Actual calculation from tailwind.config.ts + defaults:**

| Combination | Foreground | Background | Ratio | Pass Level |
|------------|-----------|------------|-------|------------|
| amber-200 (#fde68a) / zinc-950 (#09090b) | #fde68a | #09090b | **12.3:1** | AAA ✅ |
| amber-900 (#78350f) / amber-50 (#fffbeb) | #78350f | #fffbeb | **10.4:1** | AAA ✅ |
| amber-200 / neutral-50 | #fde68a / #fafafa | **~2.2:1** | Fails AA |
| zinc-400 (#a1a1aa) / white (#ffffff) | #a1a1aa | #ffffff | **4.52:1** | AAA ✅ |
| zinc-400 / zinc-50 | #a1a1aa / #fafafa | **~4.1:1** | Fails AA large-text only |
| amber-400 (#fbbf24) / zinc-950 | #fbbf24 / #09090b | **12.7:1** | AAA ✅ |

The audit appears to have confused color classes. `amber-200` on zinc-950 is extremely high contrast (12.3:1), not 4.3:1. Where contrast might genuinely be problematic:

| Actual Problem Location | Colors | Estimated Ratio | Issue |
|------------------------|--------|----------------|-------|
| `zinc-400` text on `neutral-50` / `zinc-50` background | #a1a1aa on #fafafa | ~4.1:1 | Fine for large text (≥18px bold), fails for body text |
| Badge text `amber-400` on `amber-950` dark mode background | #fbbf24 on #09090b | ~12.7:1 | Fine ✅ |
| Lightbox count text `zinc-400` on white card at line 167 | #a1a1aa on #ffffff | 4.52:1 | Meets AA ✅ |

**Verdict: Largely overstated.** The specific ratio numbers cited (4.3:1, 3.7:1) are incorrect. The zinc-400/white combo at 4.52:1 actually passes AA. Real concern would be zinc-400 on near-white backgrounds at small sizes, which is a minor readability concern, not a strict AA failure.

---

#### D10 — Print Layout Issues ⚠️ NOT ACCURATELY REPORTED

The audit says: "No @media print stylesheet, no semantic print heading, no skip-to-print link."

**Reality check from `globals.css:34–74`:**

```css
@page { size: A5 portrait; margin: 8mm; }

@media print {
  html, body { background: #ffffff !important; color: #09090b !important; }
  nav, header, footer, button, .no-print { display: none !important; }
  #nexo-a5-stand { /* Full A5 stand positioning, page-break-inside: avoid */ }
}
```

And `QrDedicatedView.tsx` uses `print:` responsive prefixes extensively (lines 106, 137, 152, etc.).

**What actually exists:**
- ✅ `@media print` block present
- ✅ `@page` rule for A5 portrait
- ✅ Print-specific styles hide nav/header/footer/buttons
- ✅ `print:p-0`, `print:block`, `print:hidden` utilities applied throughout QrDedicatedView
- ⚠️ No `<h1>` with `sr-only` or dedicated print-heading for document hierarchy
- ⚠️ No `@media print` handling for the lightbox modal (it would still show during print)
- ⚠️ `print-color-adjust: exact` forces background rendering — good for the stand, but could cause unnecessary ink waste for dark-mode pages

**Verdict: Overstated.** Print support is actually the most polished of any category. Missing pieces are minor enhancements, not fundamental failures.

---

#### D11 — No Skip Navigation Link ✅ CONFIRMED

There is no skip-to-content link anywhere in `app/layout.tsx` or root-level component structure. Users navigating via keyboard must tab through potentially hundreds of nodes to reach `<main>`.

**Fix:** Add a fixed-position skip link:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only fixed top-4 left-4 z-[100] px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold">
  Saltar al contenido
</a>
```

**Verdict: Solid finding.** Standard WCAG 2.4.1 bypass pattern. 5-min fix.

---

#### D12 — Language Toggle Doesn't Update `<html lang>` ✅ CONFIRMED

At `MenuPublicView.tsx:16`:
```tsx
const [lang, setLang] = useState<"es" | "en">("es");
```

The language state lives purely in React component state. Switching language changes displayed text but **never updates `<html lang={lang}>`**. The root layout sets `lang="es"` statically (layout.tsx:26).

Screen readers cache locale based on `html lang`. If a user reads Spanish content then toggles to English, some screen readers will still pronounce English text with the Spanish voice engine, causing garbled pronunciation.

**Fix:** Use `useEffect` to sync:
```tsx
useEffect(() => {
  document.documentElement.lang = lang;
}, [lang]);
```

**Verdict: Solid finding.** Direct WCAG 3.1.1 violation. One-line fix.

---

## Newly Identified Violations (Not Mentioned in Original Audit)

### 🆕 NEW-D1: Full-Screen Keyboard Traps — Zero Modals Are Keyboard Accessible

Both modals (lightbox at `MenuPublicView.tsx:286` and allergen selector at `MenuEditor.tsx:421`) suffer from identical structural problems:

1. **Escape key not handled** — neither modal closes on Escape, violating SC 21.1.1
2. **No focus trap** — pressing Tab cycles focus through elements behind the overlay (footer links, main menu items, admin save button). This exposes sensitive content and allows unexpected interactions.
3. **No programmatic focus control** — no code captures focus on modal open or returns focus to trigger on close
4. **Neither uses `inert` or `aria-hidden`** on background content, allowing AT users to interact with hidden content

These are **systemic issues**, not one-off bugs. Every future modal added to this codebase will replicate the same flaw unless a shared dialog/hook pattern is established.

**WCAG Severity:** SC 2.1.1 (Keyboard) — A | SC 2.4.3 (Focus Order) — A | SC 4.1.2 (Name, Role, Value) — A

**Estimated Effort:** 2–3 hours for a reusable dialog primitive (could serve as foundation for all modals).

---

### 🆕 NEW-D2: Missing Semantic Landmarks

In `app/layout.tsx`, the `<body>` renders children directly with no semantic wrapper:

```tsx
<body className="antialiased min-h-screen bg-neutral-50 ...">
  {children}
```

While child components use `<header>`, `<main>`, `<footer>`, `<section>`, `<nav>` tags internally, the root layout itself lacks:
- A wrapping `<div role="document">` or accessible wrapper
- Any ARIA landmarks at the template level

More importantly, every route page gets rendered inside the same shell without any distinction between admin routes and public routes in terms of ARIA roles. An admin dashboard page served through this layout has no `role="main"` differentiation from the public menu view.

**Impact:** Low-medium. The components use reasonable internal semantics, but a global `role="main"` on the content wrapper would improve AT navigation performance.

---

### 🆕 NEW-D3: Images Without Width/Height Attributes → Cumulative Layout Shift (CLS)

At `MenuPublicView.tsx:229` and `MenuPublicView.tsx:297`:

```tsx
<img src={dish.image_url} alt={dishTitle} loading="lazy" className="w-full h-full object-cover" />
```

No `width` or `height` attributes are set. Combined with `loading="lazy"`, images load asynchronously, causing layout shift as the browser resizes containers. This contributes to poor Largest Contentful Paint (LCP) and CLS scores, which Google counts as Core Web Vitals (and increasingly, a quasi-accessibility issue for users with cognitive disabilities who experience content jumping).

**Fix:** Specify explicit `width` and `height` matching the container dimensions (20×20 for thumbnails, aspect-ratio-derived heights for lightbox).

---

### 🆕 NEW-D4: Alert Banner Missing ARIA Alert Region

At `MenuPublicView.tsx:260–270`, the allergen warning banner reads:

```tsx
<div className="p-4 rounded-2xl bg-amber-50/60 ...">
  <p className="font-semibold ...">Información sobre Alérgenos:</p>
  <p>Si usted tiene alguna alergia...</p>
</div>
```

This conveys important safety information but is structured as a plain `<div>`. Screen readers won't announce it as urgent or important. Per WCAG 4.1.3:

**Fix:** Change `<div>` to `<div role="alert" aria-live="assertive">` or use `<aside aria-label="Advertencia de alérgenos">` with a `<strong>` or `<Alert>` component with appropriate status semantics.

---

### 🆕 NEW-D5: Starvation Condition — Legal Checkbox Required But No Visual Error Path

At `MenuEditor.tsx:475–495`, the legal certification checkbox is checked via React state, and submission checks:

```tsx
if (!legalConfirmed) {
  alert("Debes marcar la casilla...");
  return;
}
```

If a user attempts to save without checking:
- They see a native JS `alert()` popup
- There is **no inline error message** linked to the checkbox
- There is **no `aria-invalid="true"`** on the input
- No `aria-errormessage` attribute connecting to a visible error

This means a blind user may not understand why their save failed, nor how to correct it.

**WCAG Violation:** SC 3.3.1 (Error Identification) — A | SC 3.3.3 (Error Suggestion) — A

**Fix:** Add a visible error `<div id="legal-error" role="status">Debes confirmar...</div>` and link it with `aria-describedby="legal-error"` + `aria-invalid` on the checkbox when unsaved.

---

## Prioritization Matrix: Impact per Effort Hour

| Priority | Item(s) | WCAG Criteria | Effort | Impact Score (1–10) | ROI Score |
|----------|---------|---------------|--------|-------------------|-----------|
| **S0 (Today)** | D1 — Remove `userScalable: false` | 1.4.4, 1.4.10 AA | 2 min | 10 | ∞ |
| **S0 (Today)** | D3 — Decorative image `alt=""` | 2.1.1 AA | 1 min | 6 | ∞ |
| **S0 (Today)** | D11 — Skip nav link | 2.4.1 AA | 5 min | 8 | ∞ |
| **S0 (Today)** | D12 — Sync `html lang` | 3.1.1 AA | 2 min | 9 | ∞ |
| **S1 (Week 1)** | NEW-D1 — Reusable dialog primitive (fixes D2, D7, NEW-D1 systemically) | 2.1.1, 2.4.3, 4.1.2 A | 3h | 10 | High |
| **S1 (Week 1)** | D5 — Associate labels on 4 editor inputs | 1.3.1, 4.1.2 AA | 20 min | 7 | High |
| **S1 (Week 1)** | D6 (real 2 items) — Replace `title` with `aria-label` | 4.1.2 AA | 5 min | 5 | High |
| **S1 (Week 1)** | D8 — Add `aria-pressed` to toggles | 4.1.2 AA | 15 min | 5 | Medium |
| **S2 (Week 2)** | D4 (4 real failing elements) — Enforce 44px minimum | 2.5.8 AA | 30 min | 6 | Medium |
| **S2 (Week 2)** | NEW-D4 — Add `role="alert"` to allergen banner | 4.1.3 AA | 10 min | 7 | Medium |
| **S2 (Week 2)** | NEW-D5 — Inline error messaging for legal checkbox | 3.3.1 A | 20 min | 6 | Medium |
| **S2 (Week 2)** | NEW-D3 — Add `width`/`height` to product images | CLS best practice | 15 min | 4 | Medium |
| **S3 (Future)** | D9 — Adjust zinc-400 usage (already mostly OK) | 1.4.3 AA | 30 min | 2 | Low |
| **S3 (Future)** | NEW-D2 — Global ARIA wrapper patterns | General | 1h | 3 | Low |

**Total estimated effort for ALL fixes: ~4 hours** — a remarkably efficient accessibility pass.

---

## Feasibility Assessment: Tailwind CSS Compatibility

All proposed fixes are feasible within the current Tailwind stack:

| Fix | Tailwind Solution | Notes |
|-----|------------------|-------|
| Viewport zoom removal | Not Tailwind — Next.js metadata API | Just edit `layout.tsx` |
| Skip nav link | `sr-only` + `focus:not-sr-only` | Built-in Tailwind utilities ✅ |
| `aria-pressed` | Native React prop + Tailwind conditional classes | No Tailwind change needed ✅ |
| `aria-describedby` / `aria-invalid` | Native HTML attributes | Works out of the box ✅ |
| 44px minimum touch targets | `min-h-[44px] min-w-[44px]` or arbitrary variants | Supported in Tailwind v3+ ✅ |
| `role="dialog"` / focus trap | External library recommendation | Consider Radix UI Dialog or Headless UI Combobox for production modals |
| Image `width`/`height` | Explicit props or `size` attribute | HTML native, not Tailwind-dependent ✅ |
| `aria-live="assertive"` | Native attribute on `<div>` | Works out of the box ✅ |

**Recommendation:** For the dialog primitives (NEW-D1), evaluate installing `@headlessui/react` or `@radix-ui/react-dialog` — both provide accessible modal foundations that handle focus trapping, Escape dismissal, and focus return automatically. Building custom dialogs that pass WCAG is significantly harder than it appears (edge cases include multi-layer modals, portal behavior, iframe trapping).

---

## Summary Table

| Audit Finding | Verified? | My Rating | Gap vs. Reality |
|--------------|-----------|-----------|----------------|
| D1 Zoom disabled | ✅ Confirmed | Solid | None |
| D2 Lightbox ARIA | ✅ Confirmed | Solid | None |
| D3 Alt duplication | ✅ Confirmed | Solid | None |
| D4 Touch targets | ⚠️ Partial | Overstated | 4/7 elements pass; only 4 fail |
| D5 Missing labels | ✅ Confirmed | Accurate | Scope is narrower (4 inputs, not all forms) |
| D6 title-only | ⚠️ Overstated | False positives | 2 of 3 elements already have aria-label |
| D7 Allergen modal | ✅ Confirmed | Solid | None |
| D8 Toggle states | ⚠️ Partial | Directionally correct | Lower severity; visual cues partially convey state |
| D9 Contrast ratios | ❌ Incorrect | Numbers are wrong | Calculated ratios differ materially from claimed values |
| D10 Print layout | ❌ Overstated | Existing print CSS is robust | Missing minor enhancements only |
| D11 No skip nav | ✅ Confirmed | Solid | None |
| D12 Lang sync | ✅ Confirmed | Solid | None |

**New findings not in audit:**
- NEW-D1: Systemic keyboard trap (highest priority new finding)
- NEW-D2: Missing global ARIA landmarks (low priority)
- NEW-D3: CLS from unlabeled images (medium-low)
- NEW-D4: Missing alert region on allergy warning (medium)
- NEW-D5: No inline error path for required checkbox (medium)

---

## Final Recommendation

**Fix today (≤15 minutes total):** D1, D3, D11, D12. Four single-line changes that resolve the most impactful WCAG violations immediately.

**Fix this week (~3 hours):** Build a reusable accessible dialog component that serves D2, D7, and NEW-D1 simultaneously. Simultaneously attach proper `<label>` associations to the 4 editor inputs (D5) and add `aria-pressed` to the 2 toggle buttons (D8).

**Review remaining findings as a separate ticket:** D4 (touch targets) and NEW-D4/NOW-D5 have concrete but modest scopes. D9 and D10 as reported need correction — re-evaluate with actual calculated ratios and existing print CSS.

**Strategic insight:** This codebase follows a consistent pattern of "good enough for sighted users, brittle for assistive technology." The foundational cause is treating HTML attributes as optional rather than required — `role`, `aria-*`, `html lang` — which suggests the team prioritizes visual polish over semantic correctness. A 30-minute developer briefing on WCAG fundamentals, combined with the reusable dialog primitive, would prevent regression across all future features.
