# Menu Components

Components in this directory render the public-facing customer menu experience — the browsable digital menu with language switching, allergen filtering, dark mode, and lightbox photo viewing.

---

## Components

### 1. `MenuPublicView`

**File:** `MenuPublicView.tsx`

#### Purpose

The main customer-facing menu viewer. Renders a restaurant's published menu as a scrollable, filterable, bilingual (Spanish/English) experience. Features include sticky header navigation, allergen filter pills, category scroll-spy tabs, sold-out dish indicators, dish photo lightboxes, and a legal allergen warning footer. Generates both a standard view and an enhanced print-like layout.

#### Props Interface

```typescript
interface MenuPublicViewProps {
  data: FullMenuData;  // Contains restaurant info + categories with dishes
}
```

#### State Management Patterns

- **Language state**: `useState<"es" | "en">("es")` toggles displayed locale globally across all text content.
- **Dark mode state**: `useState(false)` controlled locally within this component. Applied via className `"dark"` wrapper around the root div.
- **Allergen filter**: `useState<string[]>([])` maintains an array of excluded allergen codes. Toggled via `toggleAllergenFilter(code)` and cleared via `clearFilters()`.
- **Lightbox state**: `useState<Dish | null>(null)` gates a full-screen photo overlay.

#### Side Effects

| Effect                         | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| Client-side allergen filtering | Filters `cat.dishes` by checking if any dish allergen matches an excluded code (case-insensitive `.includes(a.toLowerCase())`). |
| Clipboard/URL generation       | None directly, but renders a link to `/qr/${slug}` for QR access.  |
| Image lazy loading             | Dish images use `loading="lazy"` attribute for progressive loading. |

#### Dependencies

| Dependency                                         | Kind         | Notes                                                      |
| -------------------------------------------------- | ------------ | ---------------------------------------------------------- |
| `next/link`                                        | Framework    | Navigation links to `/qr/${slug}` and home                 |
| `@/lib/types`                                      | Internal     | `FullMenuData`, `Dish` interfaces                          |
| `@/lib/allergens`                                  | Internal     | `EU_ALLERGENS` (all 14 allergen definitions)               |
| `@/components/ui/AllergenBadge`                    | Internal     | Per-dish allergen pill rendering                           |
| `@/lib/utils`                                      | Internal     | `formatPrice` utility                                      |
| `lucide-react`                                     | External     | `Globe`, `Moon`, `Sun`, `UtensilsCrossed`, `AlertTriangle`, `Sparkles`, `QrCode`, `X`, `Maximize2` |
| `react`                                            | Built-in     | `useState`                                                 |

#### Known Issues / TODOs

- **Allergen comparison case sensitivity**: The filter logic does `excludedAllergens.includes(a.toLowerCase())` — meaning the exclusion array must also be normalized to lowercase. Since codes are added via `all.code` (which comes from `EU_ALLERGENS` as uppercase codes like `"GLUTEN"`), this works. But if anyone adds lowercase codes manually, the filter silently fails.
- **Dark mode isolation**: The `"dark"` class is applied to a wrapper `<div>` rather than the document root (`html`). Depending on Tailwind's dark mode strategy (`class` vs `media`), this may cause inconsistent theme application if sibling pages rely on system-level dark mode detection.
- **Sticky position calculation**: Tab bar uses hardcoded `top-[77px]` offset for sticky positioning relative to the allergen filter bar. If header heights change (responsive breakpoints, different text length), the offset may overlap content.
- **Lightbox click handling**: The outer backdrop `onClick` closes the lightbox, but the inner card uses `onClick={(e) => e.stopPropagation()}`. This works but could be fragile if event bubbling behavior changes.
- **Footer branding fixed at bottom**: The viral branding footer uses `fixed bottom-0` positioning, which can cover content on short menus. Consider hiding on screens with insufficient menu height.
