# ADR 0012 — Style packs 9–13 (M4) and per-scene style mixing

- **Status**: Accepted (2026-11-13)
- **Context**: M4 needs 13 style packs (T155–T159: neon, retro-vhs, whiteboard, paper-collage, three-lite) and
  scenes in different styles inside one video (T160). Same contract as ADR 0009: 8 templates with shared slot
  schemas, self-hosted fonts with full Vietnamese coverage incl. "₫", deterministic frames, overflow-safe text.

## Decisions

1. **Fonts (OFL-1.1, `@fontsource` 5.3.0)**: neon Exo 2, retro-vhs VT323 (pixel), whiteboard Patrick Hand
   (handwriting), paper-collage Bricolage Grotesque, three-lite Montserrat. Pixelify Sans was rejected (no
   Vietnamese subset). VT323 has a small x-height, so its layout scale (`vhs`) is ~15 % larger.
2. **Effects are timeline functions of time**, never timers:
   - neon: seeded flicker-on (`tl.set` opacity steps) and 1–2 seeded line glitches; static scanlines on one
     composited layer.
   - retro-vhs: grain tile (inline SVG turbulence, rasterised once) jumping 24×/s, a tracking band, a PLAY /
     timecode display, red/cyan text offset; overlays are added to the stage by code (`aria-hidden`).
   - whiteboard: words written one by one; a project-drawn hand + marker follows the word being written;
     underline / circle / sketch-box strokes drawn with `stroke-dashoffset`. Positions and stroke sizes are
     read from the live layout inside the progress callback (fonts may still be loading when `build()` runs),
     and paths are laid out in the box's own pixels (`non-scaling-stroke` broke the dash pattern).
   - paper-collage: lines on paper strips (box-shadow spread, so fitted text keeps its size), tape, stop-motion
     stepping at 8 steps/s and a seeded 4×/s "boil".
   - three-lite: **Three.js 0.186.1 (MIT) with `SVGRenderer`**, not WebGL. Render workers run Chrome with
     `--disable-gpu` and HyperFrames launches its own browser, so WebGL would depend on a software GL
     fallback that differs between machines. `SVGRenderer` projects the low-poly meshes on the CPU and draws SVG
     polygons, so frames are identical everywhere and need no GPU. Its `clear()` sets an opaque inline
     background; the pack overrides it in CSS.
3. **Style mixing (T160)**, `packages/compiler/src/mix-styles.ts`:
   - Captions always use the **primary** style: the scene pack's `#captions` rules are removed, the primary
     pack's caption rules, colour/font tokens (re-declared on `#captions`) and caption font faces are added.
     Subtitles therefore never change look between scenes. The brand logo was already global.
   - **Style bridge**: a scene whose style differs from the previous scene gets a transition (its own, or fade
     500 ms) with `fromColor` = previous style's background; `mountScene` lays a full-stage layer of that colour
     above the stage (below captions/logo) and fades it out, so two backgrounds never meet in a hard cut.
   - **Storyboard**: when a project allows extra styles (`ProduceInput.mixStyles`, CLI `--mix-styles`), the
     prompt lists them with their manifest descriptions and the model may set `styleId` per scene; the validator
     requires the primary style for the first and last scene, only allowed ids, and at most 4 switches.
     `PROMPT_VERSION` → `m4.1`.

## Consequences

- Golden frames, overflow harness and render cost of the 5 packs are measured in the render container
  (results in `docs/reports/M4.md`).
- Mixing is off unless a project lists extra styles; the web UI does not expose it yet.
- New packs are created with `scripts/new-pack.mjs`; the procedure is in `docs/style-pack-guide.md`.
