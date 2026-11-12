// makvid qa <spec.json> [--out dir] [--aspect ...]: capture checkpoint frames and check overflow,
// overlap, safe area, contrast and network. Exit 2 when any rule fails.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aspectSlug, type AspectRatio, type VideoSpec } from "@makvid/spec";
import { compileVideo, type CompiledScene } from "@makvid/compiler";
import { captureFrames, checkFrame, closeSharedBrowser, type QaIssue } from "@makvid/renderer";
import { loadPack } from "@makvid/style-kit/node";
import { emit, stylesRoot } from "../io";

/** Checkpoints per scene: after enter animations, mid-scene, and each caption chunk's midpoint. */
export function checkpoints(s: CompiledScene): number[] {
  const d = s.durationMs;
  const pts = new Set<number>([Math.round(d * 0.55), Math.round(d * 0.85)]);
  for (const c of s.captions) pts.add(Math.round((c.startMs + c.endMs) / 2 - s.startMs));
  return [...pts].filter((t) => t > 0 && t < d - 300).sort((a, b) => a - b);
}

export interface QaSceneReport {
  sceneId: string;
  checkpoints: number[];
  issues: QaIssue[];
}

export async function qaVideo(
  spec: VideoSpec,
  aspect: AspectRatio,
  out: string,
  savePngs = true,
): Promise<QaSceneReport[]> {
  const compiled = await compileVideo(spec, { aspect, stylesRoot: stylesRoot(), outDir: out, engine: "qa" });
  const dir = join(out, aspectSlug(aspect), "qa");
  mkdirSync(dir, { recursive: true });
  const reports: QaSceneReport[] = [];
  for (const s of compiled.scenes) {
    const pack = loadPack(join(stylesRoot(), spec.scenes[s.index]!.styleId));
    const pts = checkpoints(s);
    const frames = await captureFrames({
      sceneDir: s.dir,
      width: compiled.width,
      height: compiled.height,
      atMs: pts,
    });
    const issues: QaIssue[] = [];
    for (const f of frames) {
      issues.push(
        ...checkFrame(f.dom!, f.atMs, {
          aspect,
          ...(pack.manifest.safeArea?.[aspect] ? { safeArea: pack.manifest.safeArea[aspect] } : {}),
        }),
      );
      if (savePngs)
        writeFileSync(
          join(dir, `${String(s.index + 1).padStart(2, "0")}-${s.sceneId}-${f.atMs}ms.png`),
          f.png,
        );
    }
    for (const f of s.fits.filter((x) => x.overflow))
      issues.push({
        rule: "overflow",
        atMs: -1,
        elements: [f.path],
        detail: `"${f.text.slice(0, 60)}" cannot fit even at ${f.fontSize}px`,
      });
    reports.push({ sceneId: s.sceneId, checkpoints: pts, issues });
    emit(
      "qa-scene",
      { aspect, sceneId: s.sceneId, issues: issues.length },
      `[${aspect}] ${s.sceneId}: ${issues.length ? `${issues.length} issue(s)` : "ok"}`,
    );
  }
  await closeSharedBrowser();
  writeFileSync(join(dir, "report.json"), JSON.stringify(reports, null, 2));
  return reports;
}
