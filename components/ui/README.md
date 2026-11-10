# UI Components

Low-level, reusable primitive components used across all other component directories. These follow a composition-based design pattern and rely heavily on Tailwind CSS for styling.

---

## Components

### 1. `Button`

**File:** `Button.tsx`

#### Purpose

A versatile, theme-aware button primitive supporting multiple visual variants and sizes. Includes built-in loading spinner support. Serves as the foundational interactive element across the entire Nexo Menu application.

#### Props Interface

```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}
```

Extends all standard `<button>` HTML attributes (`type`, `onClick`, `disabled`, `className`, etc.) via `React.ButtonHTMLAttributes<HTMLButtonElement>`.

#### State Management Patterns

- **Stateless**: No internal state. Entirely driven by props.

#### Side Effects

- None. Pure rendering component.

#### Dependencies

| Dependency                       | Kind     | Notes                                          |
| -------------------------------- | -------- | ---------------------------------------------- |
| `@/lib/utils`                   | Internal | `cn()` — conditional class merging utility      |
| `lucide-react`                  | External | `Loader2` spinning icon for loading indicator   |
| `react`                         | Built-in | `React.FC`                                     |

#### Styling Reference

| Variant  | Background (light/dark)                              | Text (light/dark)                           | Border | Use Case             |
| -------- | ---------------------------------------------------- | ------------------------------------------- | ------ | -------------------- |
| `primary`  | `amber-600` / `amber-500` hover → `700`/`600`         | `white` / `white`                            | none   | Main CTAs            |
| `secondary`| `zinc-100` / `zinc-800` hover → `200`/`700`           | `zinc-900` / `zinc-100`                      | none   | Neutral actions      |
| `outline`  | transparent / transparent hover → `zinc-50`/`800`     | `zinc-800` / `zinc-200`                      | zinc-300/zinc-700 | Outlined buttons |
| `ghost`    | transparent hover → `zinc-100`/`800`                  | `zinc-700` / `zinc-300`                      | none   | Icon/text-only actions |
| `danger`   | `red-600` hover → `red-700`                            | `white` / `white`                            | none   | Destructive actions  |

| Size  | Padding          | Font Size  | Border Radius |
| ----- | ---------------- | ---------- | ------------- |
| `sm`  | `px-3 py-1.5`    | `text-xs`  | `rounded-lg`  |
| `md`  | `px-4 py-2`      | `text-sm`  | `rounded-xl`  |
| `lg`  | `px-6 py-3.5`    | `text-base`| `rounded-2xl` |

#### Known Issues / TODOs

- **Loading state uses `disabled`**: The button sets `disabled={disabled || isLoading}`, which greys out the entire button including children. Users cannot tell if the loading state was caused by an external `disabled` prop versus internal `isLoading`. Consider adding a distinct disabled/loading style.
- **No keyboard shortcut / focus-visible**: Missing `focus-visible:ring` outline for keyboard navigation. Relies only on focus ring from the browser default.
- **Active scale transform**: `active:scale-[0.98]` applies a brief micro-interaction but could cause layout shifts on fast clicks. Evaluate if this is worth the perf cost vs. pure color transitions.

---

### 2. `Badge`

**File:** `Badge.tsx`

#### Purpose

A generic label/tag component for displaying colored status indicators. Supports seven semantic variants covering common application states (brand, success, warning, danger, etc.). Used implicitly through `AllergenBadge` styling and available as a general-purpose tool for any labeled context.

#### Props Interface

```typescript
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "brand" | "allergen" | "success" | "warning" | "danger" | "outline";
}
```

Extends all standard `<span>` HTML attributes (`className`, `id`, `data-*`, etc.).

#### State Management Patterns

- **Stateless**: No internal state. Fully declarative.

#### Side Effects

- None. Pure rendering component.

#### Dependencies

| Dependency                       | Kind     | Notes                                    |
| -------------------------------- | -------- | -------------------------------------- |
| `@/lib/utils`                   | Internal | `cn()` — conditional class merging      |
| `react`                         | Built-in | `React.FC`                             |

#### Styling Reference

| Variant    | Background (light/dark)                        | Text (light/dark)                    | Border                         |
| ---------- | ---------------------------------------------- | ------------------------------------ | ------------------------------ |
| `default`  | `zinc-100` / `zinc-800`                        | `zinc-800` / `zinc-200`              | transparent                    |
| `brand`    | `amber-100` / `amber-950`                      | `amber-900` / `amber-200`            | `amber-200` / `amber-800`      |
| `allergen` | `orange-50` / `zinc-800`                       | `orange-900` / `orange-300`          | `orange-200` / `zinc-700`      |
| `success`  | `emerald-50` / `emerald-950`                   | `emerald-800` / `emerald-300`        | `emerald-200`                  |
| `warning`  | `amber-50` / `amber-950`                       | `amber-800` / `amber-300`            | `amber-200`                    |
| `danger`   | `red-50` / `red-950`                           | `red-800` / `red-300`                | `red-200`                      |
| `outline`  | transparent / transparent                      | `zinc-700` / `zinc-300`              | `zinc-300` / `zinc-700`        |

#### Known Issues / TODOs

- **Default variant selection**: Default is `"default"` which produces a neutral gray badge. May be better to require explicit variant specification to avoid accidental misuse.
- **No icon slot**: Unlike `AllergenBadge` which accepts children as text, `Badge` has no predefined icon/content slot pattern. Icons must be passed as children, which works but has no visual sizing control.
- **Limited to `<span>` semantics**: Cannot be repurposed as `<a>`, `<button>`, or other elements even though `HTMLAttributes<HTMLSpanElement>` technically allows most attributes. For link badges, callers must use a different component.

---

### 3. `AllergenBadge`

**File:** `AllergenBadge.tsx`

#### Purpose

A specialized badge component for displaying EU food allergen information. Looks up allergen metadata (icon, names in ES/EN, description) from the centralized `@/lib/allergens` module. Supports removal via an optional callback, making it suitable for both read-only display and editable annotation contexts.

#### Props Interface

```typescript
export interface AllergenBadgeProps {
  code: string;              // Allergen code, e.g., "GLUTEN", "MILK"
  lang?: "es" | "en";        // Display locale (default: "es")
  showIcon?: boolean;        // Toggle icon visibility (default: true)
  onRemove?: () => void;     // Optional remove handler — renders × button if provided
  className?: string;        // Additional Tailwind classes for customization
}
```

#### State Management Patterns

- **Stateless**: No internal state. Derived entirely from props and the `getAllergenInfo` lookup.
- **Lookup caching**: `getAllergenInfo(code)` performs a simple array/object lookup in `@/lib/allergens.ts`. The allergen list is static and small (~14 items), so cache concerns are negligible.

#### Side Effects

- None. Pure rendering component.

#### Dependencies

| Dependency                                | Kind     | Notes                                          |
| ----------------------------------------- | -------- | ---------------------------------------------- |
| `@/lib/allergens`                         | Internal | `getAllergenInfo(code)` — metadata lookup       |
| `@/lib/utils`                             | Internal | `cn()` — conditional class merging              |
| `lucide-react`                            | External | `X` icon for the remove button                  |
| `react`                                   | Built-in | `React.FC`                                     |

#### Styling

Fixed amber-themed badge style:
- Light: `bg-amber-50/80`, `text-amber-900`, `border border-amber-200/80`
- Dark: `bg-amber-950/40`, `text-amber-200`, `border border-amber-900/60`
- Font: `text-[11px] font-medium`

#### Known Issues / TODOs

- **Static styling with `className` passthrough**: While `className` is accepted and merged via `cn()`, the core styling is hard-coded (always amber theme). There's no variant prop to adjust colors based on allergen severity or category.
- **Title tooltip uses `descriptionEs`**: The `title` attribute falls back to `name` if `descriptionEs` is undefined. Tooltips on mobile devices are often unreliable — consider a more accessible alternative like an ARIA-describedby pattern.
- **No keyboard accessibility for removable variant**: The × remove button is clickable but lacks `aria-label` that adapts dynamically. The current `aria-label="Eliminar alérgeno ${name}"` works for Spanish speakers but breaks for English locales where `lang="en"`. Fix: construct `aria-label` based on `lang` prop.
- **Graceful degradation**: If `getAllergenInfo(code)` returns `undefined` (unknown code), the badge displays the raw code string with a ⚠️ icon. This is reasonable behavior but should be logged in development environments to catch data inconsistencies.
