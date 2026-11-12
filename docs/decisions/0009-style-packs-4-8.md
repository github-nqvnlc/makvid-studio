# ADR 0009 — Style packs 4–8 (M3): slides, news, terminal, glass-gradient, flat-illustration

- **Status**: Accepted (2026-11-13)
- **Context**: GATE M3 needs 8 style packs (T150–T154). Every pack must render the same VideoSpec (same 8
  templates and slot schemas), pass the max-length overflow harness in 4 aspects, use only self-hosted fonts
  with full Vietnamese coverage (incl. "₫") and stay deterministic.

## Decisions

1. **Shared structure, own identity.** Layouts come from `scripts/scaffold-layouts.mjs` with a per-pack type
   scale (new variants `slides | news | terminal | glass | flat`). Packs with top chrome (news ticker, terminal
   title bar, slide header) reserve `--reserve` px at the top of the content region; the scaffold subtracts the
   same height from every text budget, so fitted text keeps the same guarantees.
2. **Fonts (OFL-1.1, `@fontsource` 5.3.0)**: slides Lexend, news Merriweather + Inter, terminal JetBrains
   Mono, glass Be Vietnam Pro, flat Nunito. Lora was tried for news and rejected by `lint-style`: no "₫" glyph.
3. **Icons**: Lucide (`lucide-static` 1.63.0, ISC) for flat-illustration, 8 icons inlined as SVG; license in
   `THIRD_PARTY_LICENSES.md` and `packages/styles/flat-illustration/ICONS-LICENSE`.
4. **Narration cues for templates**: scenes now receive the spoken words with scene-local times
   (`SceneData.narration`, `TemplateContext.narration`) and `findCue()` (accent-insensitive). Slides reveals
   each bullet and compare card when the voice-over reaches it, with an even schedule as fallback.
5. **Glass: bitmap background, frosted glass only on small elements.** Measured in the render container
   (HyperFrames, 6 s scene, ms per frame): first version 414 (full-frame CSS radial gradients + blurred pane);
   bitmap background (tiny WebP from `tools/gen-bg.mjs`, embedded in pack.css) + pane without blur 173;
   `backdrop-filter` costs ~240 ms/frame on a region-sized pane at any radius (6 px: 413, 12 px: 414, static
   background: 337), so the real `backdrop-filter: blur(12px)` is kept only on the CTA button; cards and the
   pane use translucent fills (over the already-soft background the look is the same). Final: hook 172,
   compare 171 (minimal compare 153), cta 179.
6. **Performance budget = measured in the render container.** `apps/cli/scripts/pack-perf.ts` renders one
   scene per pack with the production HyperFrames renderer in `docker/worker-render.Dockerfile` (8 vCPU,
   16 GB, Docker Desktop on the dev machine) and reports wall time / frames after a warm-up render. Hook
   scene, all packs: minimal 158, kinetic 144, infographic 152, slides 125, news 157, terminal 128,
   flat-illustration 156, glass-gradient 172. The earlier budgets (80–90) had never been measured; every
   pack now has `perfBudget.maxMsPerFrame = 200` (≥ 12 % headroom). `PERF=1 scripts/verify-render.sh`
   re-checks them.
7. **Deferred**: the news "source image" (T152) needs scene image assets, which arrive with article ingest
   (US4, T113); the layout keeps room for it later.
