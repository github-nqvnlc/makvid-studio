# UI-G1 — Foundation (Tailwind, shadcn, theme, fonts, light/dark, language switch)

Date: 2026-11-14. Spec: [specs/002-saas-ui-revamp](../../specs/002-saas-ui-revamp/). Status: **ready for owner review**.

## What is in

- Tailwind v4 + shadcn/ui (34 components in `apps/web/src/components/ui`), theme **poppy-1**, light/dark via
  next-themes (system by default, no flash on reload).
- Language switcher (VI/EN) keeps the current page and query; signed-in users also save it to their profile
  (`PATCH /api/me`, guarded, any member), and the profile language wins right after sign-in.
- Shared pieces: `PageHeader`, `EmptyState`, `ErrorState`, `UpgradeCard`, `StatusBadge`, `UsageMeter`,
  `ColorField`, `FileDropzone`, `lib/prefs.ts`, `lib/project-query.ts`.
- ESLint (root `eslint.config.mjs`): color literals are errors in all web components; literal UI text is an error in
  `components/{common,shell,landing}` (legacy folders join as they are revamped, all of them by UI-G4).
- Old CSS keeps working in `legacy.css` (scoped under `.shell`, renamed variables) until UI-G4.

## Decisions

| Topic | Decision |
| --- | --- |
| Fonts | Plus Jakarta Sans (sans), Space Mono (mono), **Be Vietnam Pro replaces DM Sans**: DM Sans has no Vietnamese subset. All three load the Vietnamese subset; `e2e/fonts.spec.ts` checks "Ẩ Ỹ Ự ặ ở Đ đ". |
| Theme contrast | Token-only edits, measured by `test/tokens-contrast.test.ts` (every text pair ≥ 4.5:1, input outline ≥ 3:1, both themes): light `--border` black → neutral divider, dark `--input` white → mid grey, light `--secondary-foreground`/`--destructive-foreground` white → black. |
| License | `lightningcss` (MPL-2.0, Tailwind v4 build dependency) allowlisted with the owner's approval (2026-11-14); used unmodified at build time. Listed in `THIRD_PARTY_LICENSES.md`. |
| Avatars | `sharp` rejected (libvips LGPL): crop to 256 px in the browser (UI-G3). |

## Checks run

| Check | Result |
| --- | --- |
| `pnpm typecheck` / `pnpm lint` | pass / pass (0 errors) |
| `pnpm --filter @makvid/web test` | 78 passed, 9 skipped (infra opt-in). Includes vi/en key parity, token contrast, and the RBAC route-coverage test (it caught `PATCH /api/me` missing `guarded`; fixed). |
| `pnpm license:check` | OK (OFL fonts reported as REVIEW warnings, dev only) |
| `pnpm --filter @makvid/web build` | pass |
| E2E new (`theme-locale`, `fonts`) | 6/6 pass: switch keeps path and query and sets `NEXT_LOCALE`; theme persists across reload with no hydration warning; first paint dark when the OS is dark; Vietnamese glyphs in all three families |
| E2E screens | 16 screenshots, sign-in and sign-up × light/dark × vi/en × 1280/360, in [docs/reports/ui/ui-g1/](ui/ui-g1/) |
| E2E existing specs (SC-001) | all 5 existing specs pass (brand, create-and-edit, no-tech-leak, sources, m5): 8 of 9 tests passed in the full run, and the remaining one (`m5`) passed when re-run alone (3.0 min). Its first two failures were my test setup, not the code: it needs `MAKVID_PAYMENTS=mock` and `APP_URL` pointing at the test port. |

## Known, expected differences

- The old header is still used, so at 360 px it wraps to two rows. The new shell (UI-G3) replaces it.
- Pages other than sign-in/sign-up keep their legacy look for now (they only gain dark mode).

## Not covered yet

- Lighthouse and axe runs (UI-G2 for public pages, UI-G4 for all).
- Landing, pricing, new auth layout and the hero demo video (UI-G2; scripts need owner approval first).
