# Spike T001–T006 — HyperFrames 0.9.34

**Date**: 2026-11-12 · **Host**: Windows 11, 12 logical CPUs; Docker Desktop 29.6.2 (Linux VM: 12 CPU, 8.3 GB)
**Packages**: `@hyperframes/producer@0.9.34`, `@hyperframes/core@0.9.34`, `@hyperframes/player@0.9.34`,
`gsap@3.15.1`, `@fontsource/be-vietnam-pro@5.3.0`, chrome-headless-shell 153.0.8010.36, FFmpeg 8.1 (Win) / Debian (Linux)

Files: [gen.ts](gen.ts) (composition generator), [render.ts](render.ts), [determinism.ts](determinism.ts),
[chunked.ts](chunked.ts), [Dockerfile](Dockerfile), player spike in [../player-next](../player-next).

## T001 — 10 s GSAP scene with Vietnamese, 9:16 and 16:9

- Library API works as documented: `createRenderJob({ fps, quality, workers? })` + `executeRenderJob(job, dir, out, onProgress)`.
- Output verified with ffprobe: H.264 yuv420p, 30/1 fps, 300 frames, AAC audio, 10.000 s; 1920×1080 and 1080×1920.
- Vietnamese renders correctly, including Ẩ Ỹ Ự and stacked diacritics (frames checked visually).
- Layout findings that feed M1 (not engine bugs): an orphan word ("đủ") without `text-wrap: balance`;
  a counter overlapping the chart in 9:16. Both are exactly what `fitText` + DOM QA must catch.
- Composition rules learned (from the `/hyperframes` skill contract): timed elements need `class="clip"`
  + `data-start`/`data-duration`; one paused timeline registered at `window.__timelines[id]`; use `fromTo`;
  no `Date.now`, unseeded `Math.random`, timers or `repeat: -1`.

## T002 — Determinism

| Environment | Method | Result |
| --- | --- | --- |
| Linux container (`--network none`) | render 9:16 twice, decoded per-frame MD5 | **300/300 identical** |
| Windows native | same | **300/300 identical** |
| Windows vs Linux (16:9) | SSIM/PSNR | SSIM 0.9955, PSNR min 34.8 dB → visually same, **not pixel-identical** |

Conclusion: deterministic per platform. Reference/golden renders and the M6 "same spec → same video on
two machines" check MUST run inside the Linux render container (Docker Desktop on Windows runs the
same Linux image, so the requirement is achievable).

Note: without a GPU, HyperFrames deliberately forces `Page.captureScreenshot` instead of BeginFrame
(`browserGpuMode: "software"` → `forceScreenshot: true`, engine `config.js`). Determinism still holds.

## T003 — Chunked / distributed render

`planV2(dir, { fps: 30, width, height, format: "mp4", chunkSize: 100 })` → 3 × `renderChunkV2` → `assembleV2`.

| Check | Linux | Windows |
| --- | --- | --- |
| Frames / duration | 300 / 10.005 s (= single pass) | 300 / 10.000 s |
| Video vs single pass | SSIM 0.9987, PSNR min 51.8 dB (only encoder differences; no visible seam) | SSIM 0.9987 |
| Audio vs single pass | difference peak −79 dB (inaudible; no seam) | — |
| Wall time (one machine, sequential chunks) | 43 s vs 38 s single | 40 s vs 18 s |

Conclusion: chunking works and is seamless; it pays off only when chunks run on different workers.
Byte-identical output between chunked and single-pass is not expected (separate encodes); our cache
key therefore includes the render mode.

## T004 — No CDN at render time

- The producer rewrites a GSAP `<script src>` to a CDN **only when the local file is missing**
  (`rewriteUnresolvableGsapToCdn`); a mirror can be set with `HYPERFRAMES_GSAP_BASE_URL`.
  → Ship `assets/vendor/gsap/dist/gsap.min.js` inside every compiled scene.
- Fonts: families not declared with `@font-face` may be fetched from Google Fonts by the compiler.
  → Always declare `@font-face` to local `.woff2` (the compiler embeds them as data URIs).
- **Verified**: full renders succeed with `docker run --network none`.
- **Player**: `@hyperframes/player` injects the runtime from
  `cdn.jsdelivr.net/npm/@hyperframes/core@0.9.34/dist/hyperframe.runtime.iife.js` when the
  composition lacks it — and in our test it did not inject at all, so clip visibility was wrong in
  preview (title still visible at 7.5 s). Fix: include the pinned local runtime
  (`assets/vendor/hyperframe.runtime.iife.js`) in the composition. Rendering with it is
  pixel-identical to rendering without it (SSIM 1.000).

## T005 — Preview in Next.js

- Next.js 16.4.6 (App Router) + `@hyperframes/player` loaded via dynamic `import()` in a client
  component; custom element typed via `React.JSX.IntrinsicElements`. (Next 15 rejects TypeScript 7.)
- With the local runtime: `seek(7.5)` shows the same state as the MP4 (title hidden, counter "20,7");
  play advances time; the `<audio>` plays (readyState 4); **zero** requests to CDN/Google Fonts.
- To verify in M3: preview audio kept running briefly after `pause()` and was ~0.5 s ahead of the
  visual clock right after start; the `timeupdate` event did not update our React state (we read
  `currentTime` instead). Needs a proper A/V-sync test in the editor.

## T006 — Render speed (Linux container, 8 vCPU / 7 GB limit, 16:9, 300 frames)

| workers | seconds | frames/s (incl. ~5 s fixed overhead) |
| --- | --- | --- |
| 1 | 36.5 | 8.2 |
| 2 | 28.6 | 10.5 |
| 4 | 24.7 | 12.2 |
| 6 | 24.9 | 12.1 |

Estimate for 1 min 1080p30 (1,800 frames) on the standard worker: ≈ 2.5–3 min for a simple scene →
target "≤ 10 min per minute of video" met with ~3–4× headroom. Heavier styles (glass, 3D) must be
measured per style pack. Diminishing returns above 4 workers per 8 vCPU → plan 4 capture workers per
render container and scale horizontally with more containers/chunks.

## Library-API stability and < 1.0 risk

- Public API used here (`createRenderJob`, `executeRenderJob`, `planV2`, `renderChunkV2`, `assembleV2`,
  player element) is typed (`.d.ts`) and documented; v1 distributed API already deprecated in favour
  of v2 → expect churn. Five releases in two days (0.9.30–0.9.34).
- Telemetry: the CLI/skills send usage events; the library paths we use did not need network at all.
  Keep render containers on an internal network so nothing can leave.
- Mitigation (as planned): pin exact versions, thin adapter in `packages/renderer`, golden-frame suite
  must pass before any upgrade, keep the Puppeteer fallback renderer passing the same contract tests.

## Verdict

HyperFrames is suitable as the primary engine for M1, with the conditions above (local GSAP, local
fonts, local runtime in compositions, Linux container for reference renders).
