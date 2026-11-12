// compile (T080), qa with auto-fix (T081), render_scene + mux (T082).
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileVideo, CompileError, toSrt, type CompiledVideo } from "@makvid/compiler";
import {
  applySpecPatch,
  aspectSlug,
  sceneIndex,
  type AspectRatio,
  type PatchOp,
  type VideoSpec,
} from "@makvid/spec";
import { captureFrames, checkFrame, concatAndMux, probe, thumbnail, type QaIssue } from "@makvid/renderer";
import { z } from "zod";
import type { PipelineContext } from "../context";

export interface QaResult {
  spec: VideoSpec;
  passed: boolean;
  attempts: number;
  issues: Array<QaIssue & { sceneId: string }>;
}

async function compileFor(
  ctx: PipelineContext,
  spec: VideoSpec,
  aspect: AspectRatio,
): Promise<CompiledVideo> {
  return compileVideo(spec, {
    aspect,
    stylesRoot: ctx.stylesRoot,
    outDir: join(ctx.workDir, "build"),
    engine: `${ctx.renderer.id}@${ctx.renderer.version}`,
  });
}

async function inspect(ctx: PipelineContext, spec: VideoSpec, aspect: AspectRatio) {
  const video = await compileFor(ctx, spec, aspect);
  const issues: Array<QaIssue & { sceneId: string }> = [];
  for (const s of video.scenes) {
    for (const f of s.fits.filter((x) => x.overflow))
      issues.push({
        sceneId: s.sceneId,
        rule: "overflow",
        atMs: -1,
        elements: [f.path],
        detail: `cannot fit "${f.text}"`,
      });
    const at = [Math.round(s.durationMs * 0.6), Math.max(0, s.durationMs - 350)];
    const frames = await captureFrames({
      sceneDir: s.dir,
      width: video.width,
      height: video.height,
      atMs: at,
    });
    for (const f of frames)
      for (const i of checkFrame(f.dom!, f.atMs, { aspect })) issues.push({ ...i, sceneId: s.sceneId });
  }
  return { video, issues };
}

const FixOutput = z.object({
  patches: z
    .array(z.object({ slot: z.string(), value: z.union([z.string(), z.array(z.string())]) }))
    .min(1)
    .max(6),
});

/** QA every aspect; on problems ask the fast model to shorten the offending slots (≤ maxFix rounds). */
export async function qaAndFix(ctx: PipelineContext, spec0: VideoSpec, maxFix = 2): Promise<QaResult> {
  let spec = spec0;
  let attempts = 0;
  for (;;) {
    const issues: QaResult["issues"] = [];
    for (const a of spec.meta.aspectRatios) {
      try {
        issues.push(...(await inspect(ctx, spec, a)).issues);
      } catch (e) {
        if (!(e instanceof CompileError)) throw e;
        for (const msg of e.issues) {
          const m = /scene "([^"]+)"/.exec(msg);
          issues.push({ sceneId: m?.[1] ?? "?", rule: "overflow", atMs: -1, elements: [], detail: msg });
        }
      }
    }
    if (!issues.length) return { spec, passed: true, attempts, issues };
    if (attempts >= maxFix) return { spec, passed: false, attempts, issues };
    attempts++;
    ctx.onProgress({ step: "qa", key: "progress.qaFix", params: { attempt: attempts }, fraction: 0.72 });
    for (const sceneId of [...new Set(issues.map((i) => i.sceneId))]) {
      let idx: number;
      try {
        idx = sceneIndex(spec, sceneId);
      } catch {
        continue;
      }
      const scene = spec.scenes[idx]!;
      const r = await ctx.llm.complete({
        step: "qa_fix",
        schema: FixOutput,
        messages: [
          {
            role: "system",
            content:
              'Chữ trên màn hình của một cảnh video bị tràn hoặc đè lên nhau. Hãy RÚT GỌN các slot chữ (giữ ý, tiếng Việt có dấu, ngắn hơn khoảng 30%). Trả về DUY NHẤT JSON {"patches":[{"slot": tên slot, "value": chuỗi hoặc mảng chuỗi}]}. Không đổi slot số.',
          },
          {
            role: "user",
            content: `Slots hiện tại: ${JSON.stringify(scene.slots)}\nLỗi: ${issues
              .filter((i) => i.sceneId === sceneId)
              .map((i) => i.detail)
              .join("; ")}`,
          },
        ],
      });
      for (const u of r.usage)
        ctx.onUsage({
          step: "qa",
          provider: u.provider,
          model: u.model,
          tokensIn: u.inputTokens,
          tokensOut: u.outputTokens,
          costUsd: u.costUsd,
        });
      const ops: PatchOp[] = r.output.patches
        .filter((p) => p.slot in scene.slots && typeof scene.slots[p.slot] !== "number")
        .map((p) => ({ op: "replace", path: `/scenes/${idx}/slots/${p.slot}`, value: p.value }));
      const applied = applySpecPatch(spec, ops);
      if (applied.ok) spec = applied.spec;
    }
  }
}

export interface RenderedAspect {
  aspect: AspectRatio;
  video: string;
  srt: string;
  thumbnail: string;
  frames: number;
  durationSec: number;
  cacheHits: number;
}

/** Render all scenes (content-addressed cache), mux with the mixed audio, write SRT + thumbnail. */
export async function renderAll(
  ctx: PipelineContext,
  spec: VideoSpec,
  mixedWav: string,
  outDir: string,
  cacheDir: string,
): Promise<RenderedAspect[]> {
  const out: RenderedAspect[] = [];
  mkdirSync(cacheDir, { recursive: true });
  for (const aspect of spec.meta.aspectRatios) {
    const video = await compileFor(ctx, spec, aspect);
    const dir = join(outDir, aspectSlug(aspect));
    mkdirSync(join(dir, "scenes"), { recursive: true });
    const files: string[] = [];
    let hits = 0;
    for (const [i, s] of video.scenes.entries()) {
      ctx.onProgress({
        step: "render_scene",
        key: "progress.renderScene",
        params: { current: i + 1, total: video.scenes.length, aspect },
        fraction: 0.75 + (0.2 * (i + 1)) / video.scenes.length,
      });
      const cached = join(cacheDir, `${s.cacheKey}.mp4`);
      const file = join(dir, "scenes", `${String(i + 1).padStart(2, "0")}-${s.sceneId}.mp4`);
      if (existsSync(cached)) {
        copyFileSync(cached, file);
        hits++;
      } else {
        const t0 = performance.now();
        await ctx.renderer.renderScene({
          sceneDir: s.dir,
          width: video.width,
          height: video.height,
          fps: video.fps,
          outPath: file,
        });
        ctx.onUsage({
          step: "render_scene",
          provider: ctx.renderer.id,
          renderSeconds: (performance.now() - t0) / 1000,
          costUsd: null,
        });
        copyFileSync(file, cached);
      }
      files.push(file);
    }
    ctx.onProgress({ step: "mux", key: "progress.mux", params: { aspect }, fraction: 0.97 });
    const mp4 = join(dir, "video.mp4");
    await concatAndMux({ scenes: files, outPath: mp4, fps: video.fps, audioPath: mixedWav });
    const cues = video.scenes.flatMap((s) =>
      s.captions.map((c) => ({
        startMs: c.startMs,
        endMs: c.endMs,
        text: c.lines.map((l) => l.join(" ")).join("\n"),
      })),
    );
    const srt = join(dir, "captions.srt");
    writeFileSync(srt, toSrt(cues));
    const thumb = join(dir, "thumbnail.jpg");
    const hook = video.scenes[0]!;
    await thumbnail(mp4, Math.min(hook.durationMs / 1000 - 0.2, 1.8), thumb);
    const p = await probe(mp4);
    out.push({
      aspect,
      video: mp4,
      srt,
      thumbnail: thumb,
      frames: p.frames,
      durationSec: p.durationSec,
      cacheHits: hits,
    });
  }
  return out;
}
