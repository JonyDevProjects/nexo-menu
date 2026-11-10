# Drift Report — Nexo Menu v1.1.0

**Date:** 2026-11-08  
**Scope:** Document-to-code drift detection across all tracked specifications  
**Source Files Analyzed:**
- `docs/backlog_v1.1.md` / `docs/especificacion_backlog_v1.1.md` (identical content)
- `README.md`
- Source code under `app/`, `components/`, `lib/`, `supabase/migrations/`
- `.github/workflows/ci.yml`, `package.json`, `docker-compose.yml`

---

## docs/backlog_v1.1.md / docs/especificacion_backlog_v1.1.md

- **EPIC STATUS CLAIMS ARE ACCURATE.** EPC-01 shows code evidence of completion (EPC-01/US-101 compressor exists, US-102 lightbox exists). EPC-02 has zero corresponding source files — no Zustand store, no comanda/cart/bill-splitting components anywhere in `components/`, `lib/`, `app/`. EPC-03 has no `is_chef_special` column, no maridaje pairing logic. EPC-04 has no time-window or turno filtering. All four statuses in the epic table match implementation reality.

- **US-101 Image Compression — Web Worker claim diverges from implementation.** The spec requires processing images *"en un Web Worker utilizando Canvas API"* (line 62). Actual code in `lib/utils/dishImageCompressor.ts` performs all rendering synchronously on the main thread using `document.createElement("canvas")` — **no Web Worker instantiation exists anywhere in the project**. This contradicts the non-functional requirement §4.1 stating *"Todo procesamiento de imágenes para subida debe ejecutarse en el navegador del cliente mediante OffscreenCanvas / Web Workers."*

- **US-101 Upload handler — wrong output format in `ImageUploader.tsx`.** `components/admin/ImageUploader.tsx` line 65 compresses to `image/jpeg` at 0.82 quality, whereas the spec and the companion `dishImageCompressor.ts` both target WebP. The ImageUploader component is a dead-end artifact: it uploads JPEG, not WebP, contradicting the end-to-end WebP pipeline described in US-101.

- **US-101 File rejection — accepted file types too broad.** Spec (§Scenario "Rechazo de archivo con formato no soportado") states the system should block `.pdf` or `.exe` and show a toast *"Por favor, selecciona una imagen válida (JPG, PNG o WEBP)"*. Actual `ImageUploader.tsx` line 135 uses `accept="image/*"` which lets OS file pickers pass any image type. Validation for unsupported types happens silently via `if (!file.type.startsWith("image/")) continue` (line 90) — no user-facing error for bad extensions, and no toast mechanism exists.

- **US-102 Loading skeleton/shimmer — completely missing.** Spec (§"Carga progresiva con skeleton shimmer") demands *"los platos con imagen muestran un contenedor con proporción 16:9 y fondo skeleton animado"*. The `MenuPublicView.tsx` component shows dish images inside fixed-size buttons (`w-20 h-20 sm:w-24 sm:h-24`) with no skeleton overlay, no shimmer CSS, and no animated gradient background. There is zero shimmer-related code in this component or elsewhere in `components/menu/`.

- **US-102 Image aspect ratio diverges from spec.** Spec mandates a *"contenedor con proporción 16:9"*. Actual dish thumbnail buttons in `MenuPublicView.tsx` are square (`w-20 h-20`). The lightbox interior uses `aspect-[16/10]` (not the documented 16:9).

- **US-102 Fade-in on load — missing.** Spec states *"una vez descargada, realiza una transición suave de fade-in sin alterar el alto del elemento"*. Dish `<img>` tags in `MenuPublicView.tsx` (line 233) only have `transition-transform duration-300` (for hover scale). There is no opacity transition or fade-in keyframe for load completion.

- **US-102 Lightbox close mechanism — incomplete.** Spec says *"puede cerrar el modal deslizando hacia abajo o pulsando fuera"`. Actual code (lines 288–289, 303–306) supports closing by clicking the backdrop or the X button, but **there is no touch/swipe-down gesture handler**.

- **EPC-03 Chef Special badge (`is_chef_special`) — absent from schema.** The dishes table in `supabase/migrations/001_initial_schema.sql` has no `is_chef_special BOOLEAN` column. EU_ALLERGENS.ts defines 14 allergen codes plus a 15th entry (molluscs) beyond the standard 14 counted in some regulatory contexts — verify whether the spec's *"14 alérgenos"* count includes or excludes molluscs (currently 14 items are listed in `EU_ALLERGENS`, matching UE 1169/2011).

---

## README.md

- **No drift detected.** All CI workflows, npm scripts (`test:ci`, `test:rls`, `test:field`, `test:flow`), Docker compose commands, package versions (Next.js 15.1, React 19.0, TypeScript 5.7), GitFlow branch names, and environment variable references match the actual repository contents.
