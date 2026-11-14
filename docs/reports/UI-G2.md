# UI-G2 — Public area and auth

Date: 2026-11-14. Spec: [specs/002-saas-ui-revamp](../../specs/002-saas-ui-revamp/). Status: **ready for owner review**,
with two items not done (Lighthouse, hero video render; see "Not done").

## What is in

- Route groups under `src/app/[locale]/`: `(marketing)` (pricing, API docs), `(auth)` (sign-in, sign-up, invite),
  `(app)` (everything signed-in: admin, batches, projects, workspace). URLs did not change.
- Public header (sticky, mobile menu in a `Sheet`, language and theme switches) and footer. Terms, Privacy and
  social links show a "Sắp ra mắt / Coming soon" badge with no link (spec FR-016).
- Guest landing with the nine blocks: header, hero, three steps, style gallery (real style packs), features, use
  cases, FAQ, final call to action, footer. Signed-in users still see the project list at `/`.
- Pricing page: plans read from the database (VND in Vietnamese, USD in English, Free shown as "Miễn phí"); the
  Yearly option is disabled with a "Coming soon" badge.
- Themed 404 (also for unknown URLs, via a catch-all route) and a themed error page with "Try again".
- Sign-in / sign-up on a split screen (brand panel hidden below `lg`): shadcn Form + react-hook-form + zod,
  messages translated under each field, password show/hide with an accessible label, pending spinner, Google button
  only when configured. The invitation page was restyled the same way.
- Style cards without a thumbnail file (5 of 13 packs have none yet) show a gradient tile instead of a broken image.

## Also fixed on the way

- The shadcn files imported `cn` from an unrelated npm package named `cn`. Switched them to `@/lib/utils` and removed
  that dependency.
- `Alert` component added to `components/ui`.
- ESLint rule for literal text now also covers `components/marketing`.

## Checks

| Check | Result |
| --- | --- |
| typecheck / lint / unit tests (78) | pass |
| Production build | pass |
| New e2e `landing.spec.ts` (5 tests) | pass: blocks in vi and en, pricing with Free and disabled Yearly, 404 for unknown URLs (status 404), mobile menu sheet with no horizontal scroll at 360 px, sign-up field error then sign-up, sign-out, sign-in |
| E2E `theme-locale`, `fonts` | pass |
| Screenshots | 40 images: landing, pricing, sign-in, sign-up, 404 × light/dark × vi/en × 1280/360 in [docs/reports/ui/ui-g2/](ui/ui-g2/) |
| Existing e2e specs | full run: 13 passed, 1 failed (`m5.spec.ts`, see below) |

## Not done

- **Lighthouse** (spec T036): not run. The run needs `lighthouse` downloaded through `npx`, which the environment
  blocked. To run it yourself:
  `pnpm dlx lighthouse http://localhost:3000/ --preset=desktop --output=json --output-path=docs/reports/ui/lighthouse-desktop.json`.
- **Hero demo video** (T034): scripts are written in [assets/hero-scripts.md](assets/hero-scripts.md). The render
  needs the Linux render container and paid voices, so it is not done. The hero shows a drawn 9:16 frame until
  `public/demo/hero.<locale>.mp4` and `.webp` exist; the component picks them up with no code change.
- Style thumbnails for neon, paper-collage, retro-vhs, three-lite, whiteboard (a pre-existing gap).
- The API docs page keeps its legacy look inside the new public shell (restyled in UI-G4).

## Open issue: `m5.spec.ts` (batch ZIP)

Passed before UI-G2 (3.0 min), but fails 3 of 4 times after it, always at the batch ZIP link never appearing (the
batch itself finishes). The worker log shows `write ECONNRESET` in "non-retryable streaming request" while the render
worker uploads, and Postgres reported 12 s checkpoints and one `CONNECT_TIMEOUT` on sign-up, so the machine was under
heavy disk pressure and the object store here is the old stack's shared SeaweedFS. I did not touch batch, ZIP or storage
code in UI-G2, and the ZIP link is rendered by the unchanged `BatchProgress.tsx`. I have **not proven** it is only the
environment. Please re-run on a quiet machine: `pnpm --filter @makvid/web test:e2e m5` (needs
`MAKVID_PAYMENTS=mock` and `APP_URL` set to the test port).
