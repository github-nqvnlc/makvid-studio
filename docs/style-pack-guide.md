# How to create a style pack

A style pack is a folder in `packages/styles/<id>/` that turns any VideoSpec scene into HTML + animation.
Packs are discovered automatically (any folder with a `manifest.json`); no registration is needed.
Every pack renders the **same 8 templates with the same slot names**, so a video can switch style at any time
and scenes from different packs can be mixed (ADR 0012).

## 1. Scaffold

```bash
pnpm add -w -D --save-exact @fontsource/<font>@<version>     # an OFL font WITH a "vietnamese" subset
node scripts/new-pack.mjs <id> <layoutVariant> "<Tên tiếng Việt>" "<English name>" \
  @fontsource/<font> <Family_Name> <weight> [<weight>...] [-- <pkg> <Family> <weights...>]
```

This writes `package.json`, `tsconfig.json`, `manifest.json`, `captions.json`, the 8 slot schemas
(`scripts/scaffold-schemas.mjs`), the 32 layouts (`scripts/scaffold-layouts.mjs`) and the fonts with their
licence (`scripts/vendor-fonts.mjs`). Then run `pnpm install` so the workspace links the new package.

- **Layout variant** = the type scale of the 4 aspects. Add a new entry in `scripts/scaffold-layouts.mjs`
  (`SCALE`) when the font is unusually narrow or wide (e.g. `vhs` is larger because VT323 has a small
  x-height; `terminal` is smaller because monospace glyphs are wide). Top chrome (a ticker, a title bar, an
  on-screen display) needs a `RESERVE` height there **and** the same `--reserve` in `pack.css`.
- After scaffolding, `templates/*/layout.*.html` are the source of truth and may be edited by hand.

## 2. Files you write

| File                         | What                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`              | `description` vi/en, `contentTypes`, `musicMoods` (calm, corporate, energetic, upbeat, tech), extra `libraries` with licence          |
| `tokens.json`                | `colors` (at least bg, fg, muted, line, surface, accent, **accentInk**, captionBg, captionFg), `fonts` display/body/caption, `motion` |
| `pack.css`                   | Look of the pack. Start from an existing pack's structural rules (`.region`, `.items`, `.cards`, …)                                   |
| `templates/<id>/template.ts` | `defineTemplate({ id, build(ctx) })` — the animation of one template                                                                  |
| `lib/*.ts` (optional)        | Effects shared by the templates                                                                                                       |
| `prompt.md`                  | Tone guide (Vietnamese) shown to the AI when this style is chosen                                                                     |

Every colour is a CSS variable: `--c-<key>` from `tokens.json`, `--accent` (scene accent override),
`--f-display|body|caption` and `--fw-*` for fonts. Text placed on the accent colour must use
`var(--c-accentInk)`: brand kits replace both, and the contrast check (`packages/compiler/src/contrast.ts`)
only guarantees readable pairs that use the tokens.

## 3. Rules (checked by `pnpm makvid lint-style <id>` and the loader)

- **Deterministic**: no `Math.random`, `Date.now`, timers or `requestAnimationFrame`. Use `ctx.rng` (seeded
  per scene) and put every change on `ctx.tl` (`fromTo`, `set`, `progress`). The renderer seeks frames in any
  order; a frame must depend only on its time.
- **Self-contained**: no remote URLs, `@import` or dynamic `import()`. Fonts, images and libraries ship in the
  pack or are bundled from npm (esbuild bundles what templates import). Inline SVG built in code uses the
  `svg()` helper from `@makvid/style-kit`.
- **Vietnamese**: every font must cover all Vietnamese letters with tones and "₫" (the loader refuses the pack
  otherwise — Lora and Pixelify Sans were rejected this way).
- **Fitted text**: text is sized at compile time with the pack fonts (`{{fit ...}}` in layouts). If CSS
  changes family, weight or OpenType features of fitted text, the `{{fit}}` must say so (`font=`,
  `features=`), or QA fails. Do not add padding/borders that change the size of fitted text; to draw a
  background behind a line use a `box-shadow` spread (see `paper-collage`).
- **Licences**: no AGPL/SSPL/BUSL/CC-BY-NC (`pnpm license:check`). Add every library to `manifest.libraries`.
  Art you draw (SVG hands, shapes) is project-owned; third-party icons need their licence file in the pack.

## 4. The template context

`build(ctx)` receives `root` (#stage), `tl`, `slots`, `aspect`, `width`, `height`, `duration`, `speed`,
`rng`, `tokens`, `narration` (spoken words with scene-local times; use `findCue()` to sync reveals to the
voice), `q`/`qa` (query inside the stage), `enter(preset, targets, at, opts)` (fadeUp, fadeIn, fadeDown,
slideLeft, slideRight, pop, zoomOut, rise) and `formatNumber` (Vietnamese number format).

Fitted text is split into `.ln` (one line, block) and `.w` (one word) spans; emphasised words carry `.em`.

Patterns used by the existing packs:

- **Stepped / stop-motion motion**: several `tl.set` at discrete times (`paper-collage/lib/collage.ts`).
- **Per-frame effects** (grain, counters, 3D): one `tl.progress(0, { duration, ease: "none" }, p => …)`
  callback that computes the frame from `p * duration` (`retro-vhs/lib/vhs.ts`).
- **Layout-dependent effects** (a hand following words, strokes sized to a box): read
  `getBoundingClientRect()` / `clientWidth` **inside** the progress callback, never in `build()` — web fonts
  may not be loaded yet when `build()` runs (`whiteboard/lib/board.ts`).
- **SVG stroke drawing**: `pathLength="1"`, `stroke-dasharray: 1`, animate `stroke-dashoffset` 1 → 0. Lay
  the path out in the box's real pixel size; `vector-effect: non-scaling-stroke` breaks the dash pattern.
- **3D without a GPU**: Three.js `SVGRenderer` projects meshes on the CPU (`three-lite/lib/scene3d.ts`); its
  `clear()` sets an opaque inline background, override it in CSS.
- **Decorations** go in the margins (outside `.region`) or behind text with enough contrast; they must never
  cover fitted text. Elements added to the stage by code are `aria-hidden`.

## 5. Check it

```bash
pnpm --filter @makvid/style-<id> exec tsc -p . && pnpm --filter @makvid/style-<id> exec eslint .
pnpm makvid lint-style <id>
pnpm --filter @makvid/cli exec tsx scripts/pack-sheet.ts <id> 9:16 out/<id>.png   # host preview, all templates
```

Then in the Linux render container (`docker/worker-render.Dockerfile`, the only place goldens are valid):

- `golden <id> --update` writes golden frames for 8 templates × 4 aspects; run `golden <id>` again to prove
  the frames are identical (determinism).
- `MAKVID_RENDER_TESTS=1 MAKVID_VISUAL_TESTS=1` tests: the overflow harness fills every slot to its maximum
  length in all aspects; nothing may leave its box.
- `apps/cli/scripts/pack-perf.ts <id> hook 9:16 hyperframes`: render cost must stay under
  `manifest.perfBudget.maxMsPerFrame` (200 ms/frame). Full-frame CSS filters, `backdrop-filter` and large
  blurred shadows are the usual culprits (ADR 0009).
- `scripts/verify-render.sh` runs all of the above for every pack.

## 6. Mixing styles

A spec has one `meta.primaryStyleId`; each scene has its own `styleId`. When scenes use other packs:

- captions in every scene use the **primary** pack (its caption rules, colours and caption font are injected
  into the scene; the scene pack's own `#captions` rules are dropped) — keep caption rules flat
  (`#captions …{}`), not nested;
- a scene whose style differs from the previous one opens with a **bridge**: the previous style's background
  colour fades out over the transition (default fade 500 ms);
- the storyboard AI may assign other styles only when the project allows them (`mixStyles`), first and last
  scene stay in the primary style, at most 4 switches.
