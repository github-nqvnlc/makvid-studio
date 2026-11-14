# UI-G4 — Polish: remaining pages, old CSS removed, accessibility

Date: 2026-11-14. Spec: [specs/002-saas-ui-revamp](../../specs/002-saas-ui-revamp/). Status: **ready for owner review**.
Screenshots: [docs/reports/ui/ui-g4/](ui/ui-g4/) (home, create, billing, brand, members, assets, API, batches, profile
A representative WebP set per page (see [docs/reports/ui/README.md](ui/README.md)). Earlier gates: [UI-G1](UI-G1.md), [UI-G2](UI-G2.md), [UI-G3](UI-G3.md).

## What changed in this gate

- Restyled with shadcn and theme tokens: brand kit (color fields with hex input, live preview, file inputs), members
  (avatars, role select, invitation form), admin (tables), asset library (empty state), batch creation and progress,
  API keys and webhooks (copy button for the one-time secret), save-as-template, script and storyboard review, API
  reference page.
- **Old CSS is gone.** `legacy.css`, the `.shell` wrapper, the old top bar and `SignOutButton` were deleted;
  `rg "className=\"(shell|topbar|card|btn|badge|stack)"` finds nothing in `apps/web/src`.
- ESLint now forbids literal UI text in **every** web component (except the generated shadcn primitives and the API
  reference page, whose text comes from the OpenAPI file) and color literals everywhere.
- Accessibility check with axe on the main pages (public: `/`, `/pricing`, sign-in, sign-up, `/en`; signed in: projects,
  create, billing, brand, library, members, API, profile, batches) in light and dark: **0 serious or critical violations**.
  It found and I fixed: slider thumb without a name, tabs controlling panels that did not exist, low contrast of small
  text on the selected-card tint in dark mode, an unlabeled read-only field.
- `no-tech-leak` e2e now also walks pricing, profile, billing, members, brand, library, API, batches and a 404, in both
  languages.
- `AGENTS.md` updated (layout row, UI conventions, Windows e2e note). `THIRD_PARTY_LICENSES.md` was updated in UI-G1.

## "Coming soon" items (shown with a badge, no link)

Yearly billing, Terms of use, Privacy policy, YouTube/Facebook/TikTok links in the footer.

## Deviations from the plan, and token changes

- Theme tokens: only the contrast fixes from UI-G1 (light border, dark input outline, secondary/destructive foreground).
  Selected cards use a ring instead of a tinted background so small text stays readable in dark mode.
- Hero demo video not rendered (needs the render container and paid voices); the hero shows a drawn frame until
  `public/demo/hero.<locale>.mp4` exists (scripts in `docs/reports/assets/hero-scripts.md`).
- Lighthouse not run (downloading it through `npx` was blocked in this environment). Command to run it yourself:
  `pnpm dlx lighthouse http://localhost:3000/ --preset=desktop --output=json --output-path=docs/reports/ui/lighthouse-desktop.json`
  (and the same without `--preset` for mobile).
- Editor: no separate download dropdown or history side sheet, and pane sizes are not remembered (downloads and
  versions are cards inside the panes).
- Native browser file pickers still show the browser's own English text ("Choose File") because they are real
  `<input type="file">` elements.
- Style thumbnails missing for five style packs (a gradient tile is shown).
- Not covered by e2e: broken video URL, 360 px editor tabs, a viewer-role run of the project list (covered by the RBAC
  unit test and the cross-workspace infra test).

## Checks

| Check | Result |
| --- | --- |
| typecheck / lint / production build | pass |
| Unit tests | 99 pass; infra tests (project CRUD on Postgres, storage `deletePrefix`) pass |
| `pnpm license:check` | OK (`lightningcss` allowlisted with the owner's approval) |
| E2E | see the result below |

## E2E result of this gate

Full run of 20 tests, then a rerun of the four that failed:

| Spec | Result |
| --- | --- |
| `a11y` (4), `account`, `brand`, `fonts`, `landing` (5), `m5`, `theme-locale` (3) | pass in the full run. `m5` (batch + ZIP), which failed in UI-G2 and UI-G3, **passed** here. |
| `no-tech-leak`, `projects-crud` | failed in the full run (the second only because a background deletion was slower than my 60 s wait, now 150 s), **pass on the rerun** |
| `create-and-edit`, `sources` | **still fail on the rerun**: the video's quality-check step ends as "failed" with no error logged (`create-and-edit`) or stays "checking quality" for minutes (`sources`) |

Why I believe the last two are the machine and not the UI: the same two specs passed several times earlier today (the
last `create-and-edit` pass was after the editor was rewritten), and the same pipeline stage succeeded for other
videos in the same run (no-tech-leak, m5). At the end of the run the machine had 1.6 GB free of 16 GB, 73 node processes
and leftover headless Chrome processes, which is enough to stall BullMQ jobs (a stalled job is marked failed without an
error line). This is **not proven**: please rerun `pnpm --filter @makvid/web test:e2e create-and-edit sources` on a
fresh, quiet machine (close other apps, restart Docker/WSL first).

Earlier in this session the same kind of failures were traced to the machine: a `wslrelay.exe` process answering on
`[::1]` for the database, queue and object-store ports, and an old Redis 6.0.16. Run the e2e with `127.0.0.1` for
`DATABASE_URL` and `S3_ENDPOINT`, and a Redis 6.2 or newer.
