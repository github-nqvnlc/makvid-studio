// T027: fill every template slot with max-length Vietnamese text and check, in all 4 aspects and every
// style pack, that nothing overflows, overlaps, or leaves the safe area (DOM metrics from real Chrome).
// Opt-in (needs Chrome): MAKVID_VISUAL_TESTS=1 pnpm --filter @makvid/tests test
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseVideoSpec, type AspectRatio, type Scene, type VideoSpec } from "@makvid/spec";
import { compileVideo } from "@makvid/compiler";
import { captureFrames, checkFrame, closeSharedBrowser, type QaIssue } from "@makvid/renderer";
import { listPacks, loadPack } from "@makvid/style-kit/node";

const root = resolve(__dirname, "../..");
const stylesRoot = join(root, "packages", "styles");
const ASPECTS: AspectRatio[] = ["16:9", "9:16", "1:1", "4:5"];
const WORDS =
  "Ẩn số quan trọng nhất của lãi kép chính là thời gian dài lâu bền vững ngân hàng tiết kiệm đầu tư".split(
    " ",
  );

/** Vietnamese text of at most `n` characters (whole words only, ends with a full word). */
export function maxText(n: number, offset = 0): string {
  let s = "";
  for (let i = offset; ; i++) {
    const w = WORDS[i % WORDS.length]!;
    const next = s ? `${s} ${w}` : w;
    if ([...next].length > n) return s;
    s = next;
  }
}

function worstCaseSpec(styleId: string): VideoSpec {
  const base = parseVideoSpec(JSON.parse(readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8")));
  if (!base.ok) throw new Error(base.issues.join());
  const pack = loadPack(join(stylesRoot, styleId));
  const scenes: Scene[] = base.spec.scenes.map((s, si) => {
    const schema = pack.templates[s.templateId as keyof typeof pack.templates].schema;
    const slots: Scene["slots"] = {};
    for (const [k, def] of Object.entries(schema.slots)) {
      if (def.type === "text") slots[k] = maxText(def.maxLength, si + k.length);
      else if (def.type === "number") slots[k] = 1234567.8;
      else if (def.type === "list")
        slots[k] = Array.from({ length: def.maxItems }, (_, i) => maxText(def.itemMaxLength, i * 3));
      else if (def.type === "series")
        slots[k] = {
          series: Array.from({ length: def.maxItems }, (_, i) => ({
            label: String(2015 + i),
            value: 10 + i * 1.3,
          })),
        };
    }
    if (typeof slots.highlight === "string" && typeof slots.text === "string")
      slots.highlight = slots.text.split(" ").slice(-3).join(" ");
    return { ...s, styleId, slots };
  });
  return { ...base.spec, scenes };
}

describe.runIf(process.env.MAKVID_VISUAL_TESTS === "1")("max-length slots never overflow (T027)", () => {
  afterAll(() => closeSharedBrowser());
  for (const styleId of listPacks(stylesRoot))
    for (const aspect of ASPECTS)
      it(`${styleId} ${aspect}`, async () => {
        const spec = worstCaseSpec(styleId);
        const video = await compileVideo(spec, {
          aspect,
          stylesRoot,
          outDir: mkdtempSync(join(tmpdir(), "mkv-ovf-")),
          engine: "overflow-test",
        });
        const pack = loadPack(join(stylesRoot, styleId));
        const issues: Array<QaIssue & { scene: string }> = [];
        for (const s of video.scenes) {
          for (const f of s.fits.filter((x) => x.overflow))
            issues.push({
              scene: s.sceneId,
              rule: "overflow",
              atMs: -1,
              elements: [f.path],
              detail: `cannot fit "${f.text}"`,
            });
          const at = Math.round(s.durationMs * 0.8);
          const [frame] = await captureFrames({
            sceneDir: s.dir,
            width: video.width,
            height: video.height,
            atMs: [at],
          });
          for (const i of checkFrame(frame!.dom!, at, {
            aspect,
            ...(pack.manifest.safeArea?.[aspect] ? { safeArea: pack.manifest.safeArea[aspect] } : {}),
          }))
            issues.push({ ...i, scene: s.sceneId });
        }
        expect(issues.map((i) => `${i.scene} ${i.rule}: ${i.detail}`)).toEqual([]);
      });
});
