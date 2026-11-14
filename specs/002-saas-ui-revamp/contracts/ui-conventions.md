# Contract: UI conventions (002)

This file is the checklist every page task is built and verified against (ui-consistency "finding-patterns"
output for this feature). The old hand-written CSS is being replaced, so the conventions are set here, not
counted from the old pages. Phase 1 builds the shared pieces, and every later page reuses them.

## Tokens and styling

- Colors, radius, shadows and fonts come from theme tokens only (`bg-background`, `text-muted-foreground`,
  `border-input`, `ring-ring`, `bg-sidebar`, `chart-1..5`…). No hex/rgb/oklch literals in components; an ESLint
  rule (`no-restricted-syntax` on color literals in `className`/`style`) enforces this.
- Spacing: Tailwind scale only (`--spacing: 0.25rem`). Page padding `px-4 md:px-6 lg:px-8`, section gap `gap-6`,
  card padding from the shadcn `Card` defaults.
- Content width: app pages `max-w-6xl` (forms `max-w-3xl`); the editor is full-bleed; marketing sections use
  `max-w-6xl`.
- Font roles: `font-sans` (Plus Jakarta Sans) for UI and headings; `font-serif` slot = Be Vietnam Pro, used for
  marketing body copy only; `font-mono` (Space Mono) for keys, IDs, hex codes.
- Icons: `lucide-react` only, size `size-4` inline and `size-5` in nav.

## Page header (every app page, FR-025)

`<PageHeader title description actions />`: `h1` (`text-2xl font-semibold`), one-line description
(`text-muted-foreground`), primary action on the right (stacks under the title below `sm`).

## States (every data view, FR-043)

| State | Component | Content |
| --- | --- | --- |
| Loading | `Skeleton` in the shape of the content, via a route `loading.tsx` or `Suspense` | — |
| Empty | `<EmptyState icon title description action />` | lucide illustration icon in a tinted circle, one sentence, one primary CTA |
| Error | `<ErrorState onRetry />` | plain-language message from `errors.<code>`, "Try again" button |
| Success / failure of an action | `toast.success` / `toast.error` (sonner) | localized message, never raw server text |
| Plan-locked | `<UpgradeCard feature />` | what the feature does, which plan has it, "Upgrade" (disabled with reason if no payment method) |
| Coming soon | `<Badge variant="outline">` "Sắp ra mắt / Coming soon" | — |

## Forms

- shadcn `Form` + react-hook-form + zod. Every field has a `FormLabel`; errors sit under the field (`FormMessage`)
  as i18n keys, never zod text.
- The submit button shows a spinner and is disabled while pending, so double submit is impossible.
- Server errors: field-level when they map to a field, otherwise a toast or inline `Alert`.
- Destructive actions: `AlertDialog`. Permanent deletes say "cannot be undone"; bulk and "delete all" also need a
  typed confirmation phrase.

## Inputs

| Need | Component |
| --- | --- |
| Color | `<ColorField>`: swatch button opening a `Popover` with native picker + hex `Input` (validated `#RRGGBB`) |
| File | `<FileDropzone accept maxSize>`: drag-and-drop + button, keyboard reachable, shows file name and errors |
| Choice from few (≤ 5) visual options | `ToggleGroup` / radio cards (aspect ratio cards with a drawn frame) |
| Choice from many | `Select` (or `Combobox` with search when > 10) |
| Number with range | `Slider` + `Input type=number`, kept in sync |
| Date range | `Popover` + `Calendar mode="range"` with presets |

## Data display

- Tables: shadcn `Table` with a sticky header. Row actions sit in a `DropdownMenu` (`aria-label` = "Actions for
  {title}"). Selection uses a `Checkbox` column.
- Usage: `<UsageMeter label used limit unit />` = label, "used / limit unit", `Progress`, a warning color and
  icon at ≥ 80 %, and "Unlimited" when `limit = null`.
- Status: `<StatusBadge status />`: one variant per status group, with an icon (not color alone).
- Dates, numbers and money: next-intl formatter only.

## Accessibility (FR-045, SC-006)

- Every icon-only button has an `aria-label` (i18n). Focus ring is `ring-ring` 2 px offset, never removed.
- The skip link "Skip to content" is the first focusable element in every layout.
- Live progress text uses `aria-live="polite"`.
- `motion-safe:` for decorative transitions; `prefers-reduced-motion` disables the hero video and transitions.
- Hit targets ≥ 40 px on touch layouts.

## i18n

- No literal UI text in JSX (ESLint rule plus `messages.test.ts` parity). Brand name `MakVid Studio` is the only
  literal.
- Namespaces: keep existing ones; new ones are `shell`, `landing`, `pricing`, `account`, `projectsList`,
  `common`.
- Long Vietnamese strings: buttons use `truncate`, and table cells use `line-clamp-2` with a `title` tooltip. No
  fixed widths on text containers.

## Tests

- Keep every existing `data-testid`. New interactive elements get a `data-testid` when an e2e spec uses them.
