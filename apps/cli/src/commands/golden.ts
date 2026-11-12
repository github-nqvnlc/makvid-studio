// makvid golden <style-id> [--update] [--runtime gsap|mkv]: render every template of a pack at fixed
// checkpoints in all 4 aspects and compare with packages/styles/<id>/golden/<aspect>/<template>/<ms>.png
// (SSIM >= threshold). Goldens are only valid from the Linux render container (fonts/AA differ per OS).
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASPECT_SIZES, aspectSlug, type AspectRatio, type VideoSpec } from "@makvid/spec";
import { compileVideo } from "@makvid/compiler";
import { captureFrames, closeSharedBrowser, ffmpeg, ssim } from "@makvid/renderer";
import type { RuntimeId } from "@makvid/style-kit";
import { CliError, EXIT, emit, loadSpec, repoRoot, stylesRoot } from "../io";

const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];
export const GOLDEN_SSIM = 0.995;

/** The sample fixture restyled to one pack: one scene per template. */
export function specForPack(styleId: string): VideoSpec {
  return loadSpec(join(repoRoot, "fixtures", "specs", "sample-vi.json"), styleId).spec;
}

export interface GoldenResult {
  aspect: AspectRatio;
  template: string;
  atMs: number;
  status: "written" | "match" | "mismatch" | "missing";
  ssim?: number;
}

export async function golden(
  styleId: string,
  opts: { update: boolean; runtime?: RuntimeId; out: string; allowHost?: boolean },
): Promise<GoldenResult[]> {
  if (!process.env.MAKVID_RENDER_CONTAINER && !opts.allowHost)
    throw new CliError(
      "golden frames must be produced/compared inside the Linux render container (set MAKVID_RENDER_CONTAINER=1 there, or pass --allow-host for a local, non-authoritative check)",
      EXIT.input,
    );
  const spec = specForPack(styleId);
  const goldenRoot = join(stylesRoot(), styleId, "golden");
  const results: GoldenResult[] = [];
  for (const aspect of ASPECTS) {
    const compiled = await compileVideo(spec, {
      aspect,
      stylesRoot: stylesRoot(),
      outDir: join(opts.out, `golden-${styleId}${opts.runtime ? `-${opts.runtime}` : ""}`),
      engine: "golden",
      ...(opts.runtime ? { runtime: opts.runtime } : {}),
    });
    const { width, height } = ASPECT_SIZES[aspect];
    for (const s of compiled.scenes) {
      const template = spec.scenes[s.index]!.templateId;
      const atMs = Math.round(s.durationMs * 0.6);
      const [frame] = await captureFrames({ sceneDir: s.dir, width, height, atMs: [atMs] });
      const dir = join(goldenRoot, aspectSlug(aspect), template);
      const file = join(dir, `${atMs}.png`);
      if (opts.update) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, frame!.png);
        results.push({ aspect, template, atMs, status: "written" });
      } else if (!existsSync(file)) {
        results.push({ aspect, template, atMs, status: "missing" });
      } else {
        const actual = join(opts.out, `golden-actual-${aspectSlug(aspect)}-${template}-${atMs}.png`);
        mkdirSync(opts.out, { recursive: true });
        writeFileSync(actual, frame!.png);
        const v = await ssim(actual, file);
        results.push({
          aspect,
          template,
          atMs,
          status: v >= GOLDEN_SSIM ? "match" : "mismatch",
          ssim: +v.toFixed(5),
        });
      }
      const last = results[results.length - 1]!;
      emit(
        "golden",
        { ...last },
        `[${aspect}] ${template}@${atMs}ms: ${last.status}${last.ssim !== undefined ? ` (SSIM ${last.ssim})` : ""}`,
      );
    }
  }
  await closeSharedBrowser();
  return results;
}

/** Templates shown on a style card, in order: the first one the pack has wins. */
const THUMB_TEMPLATES = ["title", "hook", "stat", "list"];

/**
 * Static style thumbnail for the style picker (T090): the pack's title scene from the sample fixture,
 * 9:16 at 60% of the scene, saved as packages/styles/<id>/demo/thumbnail.webp (360 px wide).
 */
export async function styleThumbnail(
  styleId: string,
  opts: { out: string; width?: number },
): Promise<string> {
  const base = specForPack(styleId);
  // The fixture subtitle is a diacritics stress string; the card shows a clean product-like line instead.
  const spec: VideoSpec = {
    ...base,
    scenes: base.scenes.map((s) =>
      s.templateId === "title" ? { ...s, slots: { ...s.slots, subtitle: "Hiểu trong 30 giây" } } : s,
    ),
  };
  const aspect: AspectRatio = "9:16";
  const compiled = await compileVideo(spec, {
    aspect,
    stylesRoot: stylesRoot(),
    outDir: join(opts.out, `thumb-${styleId}`),
    engine: "thumbnail",
  });
  const pick =
    THUMB_TEMPLATES.map((t) => compiled.scenes.find((s) => spec.scenes[s.index]!.templateId === t)).find(
      Boolean,
    ) ?? compiled.scenes[0]!;
  const { width, height } = ASPECT_SIZES[aspect];
  const [frame] = await captureFrames({
    sceneDir: pick.dir,
    width,
    height,
    atMs: [Math.round(pick.durationMs * 0.6)],
  });
  const dir = join(stylesRoot(), styleId, "demo");
  mkdirSync(dir, { recursive: true });
  const png = join(opts.out, `thumb-${styleId}.png`);
  writeFileSync(png, frame!.png);
  const dest = join(dir, "thumbnail.webp");
  await ffmpeg(["-y", "-i", png, "-vf", `scale=${opts.width ?? 360}:-2`, "-quality", "82", dest]);
  unlinkSync(png);
  return dest;
}
