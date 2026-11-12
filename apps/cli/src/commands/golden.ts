// makvid golden <style-id> [--update] [--runtime gsap|mkv]: render every template of a pack at fixed
// checkpoints in all 4 aspects and compare with packages/styles/<id>/golden/<aspect>/<template>/<ms>.png
// (SSIM >= threshold). Goldens are only valid from the Linux render container (fonts/AA differ per OS).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASPECT_SIZES, aspectSlug, type AspectRatio, type VideoSpec } from "@makvid/spec";
import { compileVideo } from "@makvid/compiler";
import { captureFrames, closeSharedBrowser, ssim } from "@makvid/renderer";
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
