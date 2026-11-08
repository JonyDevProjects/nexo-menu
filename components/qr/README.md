# QR Components

Components in this directory handle QR code generation, display, downloading, and printing for restaurant table standees. Provides both a standalone dedicated QR page and a post-publish modal dialog.

---

## Components

### 1. `QrDedicatedView`

**File:** `QrDedicatedView.tsx`

#### Purpose

A dedicated page/component for displaying and exporting a restaurant's table QR standee. Features a full A5-printable template layout in a two-column design (left: preview, right: download controls + guidance). Generates QR codes pointing to the public menu URL, supports PNG and SVG downloads, clipboard URL copying, and print-to-paper workflows. Optimized for physical placement as a table tent/card stand.

#### Props Interface

```typescript
interface QrDedicatedViewProps {
  data: FullMenuData;  // Contains restaurant.slug, restaurant.name, description
}
```

#### State Management Patterns

- **Copied state**: `useState(false)` toggles visual feedback after URL copy (resets automatically via `setTimeout(..., 2500)`).
- **No persistent state**: All state is ephemeral — the component is fully derived from props plus transient UI interactions.

#### Side Effects

| Effect                            | Description                                                       |
| --------------------------------- | ----------------------------------------------------------------- |
| Clipboard API                     | `navigator.clipboard.writeText(publicUrl)` copies the menu URL. Fails silently with try/catch. |
| Canvas-based QR export (PNG)      | Serializes the SVG QR code, draws onto a 1024×1024 canvas at white background, then converts to PNG via `canvas.toDataURL("image/png")`. Triggers download via invisible `<a>` click. Uses `btoa(unescape(encodeURIComponent(svgData)))` for SVG encoding — a manual SVG-to-data-URI pipeline without proper XML namespace handling. |
| Blob-based QR export (SVG)        | Creates an `XMLSerializer` output blob, generates an object URL, triggers download, then revokes the object URL. |
| Browser print                     | `window.print()` invoked for direct printer output with `print:`-prefixed CSS rules for layout adjustments. |
| Public URL resolution             | Constructs `publicUrl` from `window.location.origin` at runtime (SSR-safe with typeof guard). Falls back to `https://nexo-menu.vercel.app/m/${slug}` on server side. |

#### Dependencies

| Dependency                                         | Kind         | Notes                                                      |
| -------------------------------------------------- | ------------ | ---------------------------------------------------------- |
| `next/link`                                        | Framework    | Navigation links: back to menu, view menu, open QR page    |
| `qrcode.react`                                     | External     | `QRCodeSVG` component — generates the QR code vector       |
| `@/lib/types`                                      | Internal     | `FullMenuData`                                             |
| `@/components/ui/Button`                           | Internal     | All action buttons (print, download, copy)                 |
| `lucide-react`                                     | External     | ~12 icons: Download, Printer, FileCode, ArrowLeft, ExternalLink, Copy, Check, QrCode, UtensilsCrossed, Info, Sparkles |
| `react`                                            | Built-in     | `useState`, `useRef`                                       |

#### Known Issues / TODOs

- **SVG encoding safety**: The `downloadPNG` function uses `btoa(unescape(encodeURIComponent(svgData)))` to encode SVG data. This approach can break with SVGs containing non-ASCII characters (e.g., emoji in restaurant descriptions). A more robust solution would use `Array.prototype.map` with `String.fromCharCode` or the Web Streams API.
- **Unused import**: `RefreshCw` and `ChevronDown/ChevronUp` are NOT imported in this file — double-check that no unused Lucide icons snuck in. Verified: these do not appear in `QrDedicatedView.tsx`.
- **Hardcoded Vercel fallback URL**: The SSR fallback is `https://nexo-menu.vercel.app/m/${slug}` — if deployment domain changes, this value needs updating. Better to derive from environment variables or the Next.js app config.
- **Missing alt text on some images**: The print template text includes descriptive phrases but the SVG QR itself has no accessible alt text. Consider adding `role="img"` and `aria-label` to the QR container.

---

### 2. `QrDownloadModal`

**File:** `QrDownloadModal.tsx`

#### Purpose

A post-publish success modal shown immediately after a menu is saved. Provides the restaurant owner with quick access to the published menu link, a dedicated QR page link, downloadable QR assets (PNG/SVG), print functionality, and an optional email-linking form for later menu edits. Also uses an A5 printable template.

#### Props Interface

```typescript
interface QrDownloadModalProps {
  isOpen: boolean;         // Controls visibility; component early-returns when false
  onClose: () => void;     // Close callback (render dismiss button, ESC key not implemented)
  restaurantName: string;  // Restaurant display name for template header
  slug: string;            // Used to build public URL paths
}
```

#### State Management Patterns

- **Visibility control**: Fully controlled via `isOpen` prop — renders `null` when false.
- **Email linking state**: 
  - `email: string` — bound input value
  - `isLinking: boolean` — loading state during async email linking
  - `linkSuccess: boolean` — shows success banner after successful API call
  - `linkError: string | null` — displays error messaging
- **Copy feedback**: Unlike `QrDedicatedView`, this component does NOT implement a copy-to-clipboard feature (that's handled on the dedicated QR page instead).

#### Side Effects

| Effect                            | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| Server action call                | `linkEmailAction(email)` from `@/app/actions/auth` sends a passwordless magic link to the restaurant owner. Result checked for `success` field; errors propagated. |
| Email validation                  | Client-side check: rejects empty strings and strings without `@`. Error shown inline. |
| Canvas-based QR export (PNG)      | Same pattern as `QrDedicatedView`: SVG serialization → canvas draw → PNG download via invisible anchor. |
| Blob-based QR export (SVG)        | Same pattern as `QrDedicatedView`: XMLSerializer → Blob → object URL → download → revoke. |
| Browser print                     | `window.print()` with identical print-specific CSS overrides.        |
| Public URL resolution             | Runtime `window.location.origin` construction with SSR fallback.     |

#### Dependencies

| Dependency                                         | Kind         | Notes                                                      |
| -------------------------------------------------- | ------------ | ---------------------------------------------------------- |
| `qrcode.react`                                     | External     | `QRCodeSVG` component                                      |
| `@/app/actions/auth`                               | Internal     | `linkEmailAction` — server action for magic link sending   |
| `@/components/ui/Button`                           | Internal     | All action buttons                                         |
| `lucide-react`                                     | External     | ~9 icons: Download, Printer, X, ExternalLink, Check, FileCode, Mail, ShieldCheck, Loader2, QrCode |
| `react`                                            | Built-in     | `useState`, `useRef`                                       |

#### Known Issues / TODOs

- **ESC key / backdrop dismissal**: Modal has no escape-key listener and the backdrop click does NOT close the modal. Users must click the explicit X button or navigate away. Add `onDismiss` via backdrop click or `keydown` listener.
- **Form missing `novalidate`**: The email form relies on HTML5 constraint validation but also does manual `@` checking. Browsers may show their own validation bubbles alongside the custom error. Recommend `noValidate` + full custom validation.
- **Duplicate download logic**: The PNG and SVG download implementations in this component are nearly identical to `QrDedicatedView`'s. This should be extracted to a shared hook or utility function to eliminate duplication.
- **No keyboard trap**: As a modal, focus should be trapped within the dialog and restored on close. Neither is implemented.
- **Scroll overflow on small screens**: The `max-h-[92vh]` container scrolls internally but the backdrop remains static. On very tall templates, content may exceed viewport. Test edge cases.
- **Server action error swallowing**: `catch (err: any)` preserves `err.message` but doesn't log the stack. Could mask root causes in production.

---

## Shared QR Implementation Notes

| Aspect                | Detail                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **QR Generation**     | Both components use `qrcode.react`'s `QRCodeSVG` with `level="H"` (highest error correction) and `includeMargin={true}` for WCAG contrast compliance. |
| **PNG Export Pipeline** | SVG serialize → UTF-8 encoded base64 via `btoa` → `<img>` onload → 1024×1024 canvas fill + drawImage → `toDataURL("image/png")`. |
| **SVG Export Pipeline** | SVG serialize → `Blob([svgData], {"type":"image/svg+xml"})` → `createObjectURL` → `<a>` click → `revokeObjectURL`. |
| **Print Styling**     | Extensive `print:` Tailwind classes override colors, borders, dimensions, and layouts for A5 (148×210mm) paper output. |
| **Responsive Design** | Grid switches from single column (mobile) to 2-column (desktop `lg:` breakpoint).                  |
| **Accessibility**     | Missing: focus trapping, aria-modal, escape key, skip links.                                        |
