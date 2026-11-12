// makvid render <spec.json> [--out dir] [--aspect 16:9,...] [--renderer hyperframes|fallback] [--fps 30]
//               [--no-cache] [--frame-hashes] [--runtime gsap|mkv]
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { aspectSlug, type AspectRatio } from "@makvid/spec";
import { CompileError, compileVideo, toSrt, type CompiledVideo } from "@makvid/compiler";
import { concatAndMux, createRenderer, frameHashes, probe, thumbnail, type Renderer } from "@makvid/renderer";
import type { RuntimeId } from "@makvid/style-kit";
import { CliError, EXIT, emit, loadSpec, stylesRoot } from "../io";

export interface RenderOptions {
  out: string;
  aspects?: AspectRatio[];
  renderer: "hyperframes" | "fallback";
  fps?: number;
  cache: boolean;
  frameHashes: boolean;
  runtime?: RuntimeId;
  workers?: number;
  style?: string;
}

export interface AspectResult {
  aspect: AspectRatio;
  video: string;
  frames: number;
  durationSec: number;
  cacheHits: number;
  renderedScenes: number;
  seconds: number;
}

export async function renderVideo(specPath: string, o: RenderOptions): Promise<AspectResult[]> {
  const { spec } = loadSpec(specPath, o.style);
  const aspects = o.aspects ?? spec.meta.aspectRatios;
  const renderer: Renderer = createRenderer(o.renderer, {
    workers: o.workers ?? Number(process.env.RENDER_WORKERS ?? 4),
  });
  const cacheDir = resolve(process.env.MAKVID_CACHE_DIR ?? join(o.out, ".cache"));
  const results: AspectResult[] = [];
  try {
    for (const aspect of aspects) {
      const t0 = performance.now();
      const slug = aspectSlug(aspect);
      const dir = join(o.out, slug);
      mkdirSync(dir, { recursive: true });
      let compiled: CompiledVideo;
      try {
        compiled = await compileVideo(spec, {
          aspect,
          stylesRoot: stylesRoot(),
          outDir: o.out,
          engine: `${renderer.id}@${renderer.version}`,
          ...(o.runtime ? { runtime: o.runtime } : {}),
          ...(o.fps ? { fps: o.fps } : {}),
        });
      } catch (e) {
        if (e instanceof CompileError) throw new CliError(e.message, EXIT.input);
        throw e;
      }
      emit(
        "compiled",
        { aspect, scenes: compiled.scenes.length },
        `[${aspect}] compiled ${compiled.scenes.length} scenes`,
      );
      const sceneFiles: string[] = [];
      let hits = 0;
      for (const s of compiled.scenes) {
        const cached = join(cacheDir, `${s.cacheKey}.mp4`);
        const outPath = join(dir, "scenes", `${String(s.index + 1).padStart(2, "0")}-${s.sceneId}.mp4`);
        if (o.cache && existsSync(cached)) {
          copyFileSync(cached, outPath);
          hits++;
          emit("scene", { aspect, sceneId: s.sceneId, cache: "hit" }, `[${aspect}] ${s.sceneId}: cache hit`);
        } else {
          const ts = performance.now();
          try {
            await renderer.renderScene({
              sceneDir: s.dir,
              width: compiled.width,
              height: compiled.height,
              fps: compiled.fps,
              outPath,
            });
          } catch (e) {
            throw new CliError(
              `render failed for scene "${s.sceneId}" (${aspect}): ${(e as Error).message}`,
              EXIT.render,
            );
          }
          mkdirSync(cacheDir, { recursive: true });
          copyFileSync(outPath, cached);
          emit(
            "scene",
            {
              aspect,
              sceneId: s.sceneId,
              cache: "miss",
              seconds: +((performance.now() - ts) / 1000).toFixed(2),
            },
            `[${aspect}] ${s.sceneId}: rendered in ${((performance.now() - ts) / 1000).toFixed(1)}s`,
          );
        }
        sceneFiles.push(outPath);
      }
      const video = join(dir, "video.mp4");
      try {
        await concatAndMux({ scenes: sceneFiles, outPath: video, fps: compiled.fps });
      } catch (e) {
        throw new CliError(`mux failed (${aspect}): ${(e as Error).message}`, EXIT.render);
      }
      const cues = compiled.scenes.flatMap((s) =>
        s.captions.map((c) => ({
          startMs: c.startMs,
          endMs: c.endMs,
          text: c.lines.map((l) => l.join(" ")).join("\n"),
        })),
      );
      writeFileSync(join(dir, "captions.srt"), toSrt(cues));
      const p = await probe(video);
      await thumbnail(video, Math.min(1.5, p.durationSec / 2), join(dir, "thumbnail.jpg"));
      if (o.frameHashes)
        writeFileSync(join(dir, "frames.sha256"), (await frameHashes(video)).join("\n") + "\n");
      const seconds = +((performance.now() - t0) / 1000).toFixed(1);
      const report = {
        aspect,
        video: "video.mp4",
        width: p.width,
        height: p.height,
        fps: p.fps,
        frames: p.frames,
        durationSec: p.durationSec,
        vcodec: p.vcodec,
        pixFmt: p.pixFmt,
        acodec: p.acodec,
        renderer: `${renderer.id}@${renderer.version}`,
        cacheHits: hits,
        renderedScenes: compiled.scenes.length - hits,
        seconds,
        scenes: compiled.scenes.map((s) => ({
          id: s.sceneId,
          startMs: s.startMs,
          durationMs: s.durationMs,
          cacheKey: s.cacheKey,
          fits: s.fits,
        })),
      };
      writeFileSync(join(dir, "report.json"), JSON.stringify(report, null, 2));
      emit(
        "done",
        { aspect, video, frames: p.frames, seconds },
        `[${aspect}] ${video} (${p.width}x${p.height}, ${p.frames} frames, ${seconds}s)`,
      );
      results.push({
        aspect,
        video,
        frames: p.frames,
        durationSec: p.durationSec,
        cacheHits: hits,
        renderedScenes: compiled.scenes.length - hits,
        seconds,
      });
    }
  } finally {
    await renderer.close?.();
  }
  return results;
}
