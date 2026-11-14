# Page checklists (ui-consistency "finding-patterns" output)

Source of truth: [contracts/ui-conventions.md](../contracts/ui-conventions.md) and
[contracts/ui-routes.md](../contracts/ui-routes.md). The old pages are being replaced, so these conventions are
set by the contracts, not counted from old pages. Every page task ticks the **Common** list plus its own lines.

## Common (every page)

- [ ] Theme tokens only: no color literals (ESLint `no-restricted-syntax` enforces it)
- [ ] `PageHeader` with title, one-line description and primary action (app pages)
- [ ] Loading = `Skeleton` in content shape; empty = `EmptyState`; error = `ErrorState` with retry
- [ ] Plan-locked features show `UpgradeCard`; coming-soon items show an outline `Badge`
- [ ] No literal UI text: every string through next-intl; vi and en keys in the same commit
- [ ] Icons from `lucide-react`; icon-only buttons have an i18n `aria-label`
- [ ] Forms: shadcn `Form` + react-hook-form + zod, errors as i18n keys, submit disabled while pending
- [ ] Destructive actions in `AlertDialog` ("cannot be undone" for permanent deletes)
- [ ] Dates/numbers/money via the next-intl formatter
- [ ] Works at 360 px with no horizontal scroll; long Vietnamese strings truncate or wrap
- [ ] Existing `data-testid` kept; light and dark both readable

## Per page (extra lines)

| Page | Extra checks |
| --- | --- |
| `/` guest (landing) | 9 sections, hero poster then muted 9:16 demo, reduced-motion = poster only, mobile menu in a `Sheet` |
| `/` signed in | stats, grid/table toggle, URL-synced filters, search without accents, rename, delete one/many/all with typed phrase |
| `/pricing` | plans from DB, Free shows "Miễn phí", Yearly = "Coming soon" |
| `/sign-in`, `/sign-up`, `/invite/[token]` | split screen, per-field errors, password eye toggle labelled, Google button only when configured |
| `/projects/new` | 4 sections + quota summary, same POST body as before, voice picker with tabs/filter |
| `/projects/[id]` | 3 resizable panes / tabs on mobile, correctly shaped player, undo/redo, download menu, visible error + retry |
| `/batches`, `/batches/[id]` | locked with `UpgradeCard` when the plan has no batch |
| `/workspace/brand` | `ColorField` for colors, font preview, contrast error shown inline |
| `/workspace/assets` | `FileDropzone`, empty state, delete confirm |
| `/workspace/members` | avatars, role select by rbac, invite form |
| `/workspace/billing` | `UsageMeter` per quota, warning ≥ 80 %, plan cards |
| `/workspace/api` | locked card when API is off, key shown once, `font-mono` for keys |
| `/account` | name, avatar crop, change password (hidden for Google-only accounts), theme, language |
| `/admin` | platform admins only, 404 otherwise |
| 404 / error | themed, link home, "Try again" |
