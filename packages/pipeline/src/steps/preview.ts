// Storyboard thumbnail grid for review mode (T091): one keyframe per scene, before any voice or render cost.
// Scenes are compiled with estimated timing (no narration yet) and captured at 60% of the scene, when the
// entrance animations have settled. Thumbnails are small JPEGs for the review screen.
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileVideo } from "@makvid/compiler";
import { captureFrames, ffmpeg } from "@makvid/renderer";
import type { VideoSpec } from "@makvid/spec";
import type { PipelineContext } from "../context";

export interface ScenePreview {
  sceneId: string;
  templateId: string;
  /** JPEG path (work dir). */
  image: string;
  /** Narration spoken over the scene. */
  text: string;
}

export async function storyboardPreview(
  ctx: PipelineContext,
  spec: VideoSpec,
  width = 360,
): Promise<ScenePreview[]> {
  const aspect = spec.meta.aspectRatios[0]!;
  const video = await compileVideo(spec, {
    ...(ctx.brand ? { brand: ctx.brand } : {}),
    aspect,
    stylesRoot: ctx.stylesRoot,
    outDir: join(ctx.workDir, "preview-build"),
    engine: `${ctx.renderer.id}@${ctx.renderer.version}`,
  });
  const dir = join(ctx.workDir, "previews");
  mkdirSync(dir, { recursive: true });
  const text = new Map(spec.script.map((s) => [s.id, s.text]));
  const out: ScenePreview[] = [];
  for (const s of video.scenes) {
    const [frame] = await captureFrames({
      sceneDir: s.dir,
      width: video.width,
      height: video.height,
      atMs: [Math.round(s.durationMs * 0.6)],
    });
    const png = join(dir, `${s.sceneId}.png`);
    const jpg = join(dir, `${s.sceneId}.jpg`);
    writeFileSync(png, frame!.png);
    await ffmpeg(["-y", "-i", png, "-vf", `scale=${width}:-2`, "-q:v", "4", jpg]);
    unlinkSync(png);
    const scene = spec.scenes.find((x) => x.id === s.sceneId)!;
    out.push({
      sceneId: s.sceneId,
      templateId: scene.templateId,
      image: jpg,
      text: scene.scriptRefs.map((r) => text.get(r) ?? "").join(" "),
    });
  }
  return out;
}
