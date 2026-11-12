// M2 acceptance (T086): produce every prompt in fixtures/prompts/m2-acceptance.json automatically, then
// measure QA, caption sync (MFA re-alignment of the whole narration), loudness, duration and cost.
// Usage (from apps/cli, .env loaded, worker-align running):
//   pnpm exec tsx scripts/m2-acceptance.ts [--out ../../tests/visual/out/m2] [--only id1,id2]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { measureLoudness } from "@makvid/media";
import { MfaAligner, mapAlignedWords } from "@makvid/tts";
import { produce } from "../src/commands/produce";
import { repoRoot } from "../src/io";

const { values } = parseArgs({
  options: { out: { type: "string" }, only: { type: "string" }, renderer: { type: "string" } },
});
const fx = JSON.parse(readFileSync(join(repoRoot, "fixtures", "prompts", "m2-acceptance.json"), "utf8")) as {
  aspect: "9:16";
  durationSec: number;
  prompts: Array<{ id: string; kind: string; prompt: string }>;
};
const outRoot = resolve(values.out ?? join(repoRoot, "tests", "visual", "out", "m2"));
const only = values.only?.split(",");
mkdirSync(outRoot, { recursive: true });

async function captionSync(dir: string) {
  const spec = JSON.parse(readFileSync(join(dir, "spec.json"), "utf8"));
  const words: Array<{ text: string; startMs: number }> = spec.audio.narration.words;
  const aligned = (
    await new MfaAligner().align({
      audio: readFileSync(join(dir, "narration.wav")),
      transcript: spec.script.map((s: { text: string }) => s.text).join(" "),
      language: "vi",
    })
  ).words;
  const heard = mapAlignedWords(
    words.map((w) => w.text),
    aligned,
    1e9,
  );
  const errs = words.map((w, i) => Math.abs(w.startMs - heard[i]!.startMs)).sort((a, b) => a - b);
  const q = (p: number) => errs[Math.floor(p * (errs.length - 1))]!;
  return { words: errs.length, medianMs: q(0.5), p95Ms: q(0.95), maxMs: q(1) };
}

const rows: Array<Record<string, unknown>> = [];
for (const p of fx.prompts) {
  if (only && !only.includes(p.id)) continue;
  const dir = join(outRoot, p.id);
  const t0 = performance.now();
  try {
    const r = await produce({
      prompt: p.prompt,
      aspects: [fx.aspect],
      durationSec: fx.durationSec,
      out: dir,
      renderer: (values.renderer as "hyperframes" | "fallback") ?? "hyperframes",
      cacheDir: join(outRoot, "_render-cache"),
    });
    const sync = await captionSync(dir);
    const out = r.outputs[0]!;
    const loud = await measureLoudness(out.video);
    const fallbackUsed = r.usage.some((u) => u.model === "DeepSeek-V4.1-Flash");
    const durationOk = Math.abs(out.durationSec - fx.durationSec) / fx.durationSec <= 0.2;
    const clean = r.status === "ready" && sync.p95Ms < 100 && Math.abs(loud.integrated - -14) <= 1;
    rows.push({
      id: p.id,
      kind: p.kind,
      clean,
      status: r.status,
      title: r.title,
      style: r.styleId,
      scenes: r.spec.scenes.length,
      durationSec: +out.durationSec.toFixed(1),
      durationOk,
      qaAttempts: r.qa.attempts,
      captionP95Ms: sync.p95Ms,
      captionMaxMs: sync.maxMs,
      lufs: +loud.integrated.toFixed(1),
      llmFallback: fallbackUsed,
      costUsd: r.costUsd,
      seconds: +((performance.now() - t0) / 1000).toFixed(0),
      video: out.video,
    });
  } catch (e) {
    rows.push({
      id: p.id,
      kind: p.kind,
      clean: false,
      status: "error",
      error: (e as Error).message.slice(0, 300),
      seconds: +((performance.now() - t0) / 1000).toFixed(0),
    });
  }
  writeFileSync(join(outRoot, "acceptance.json"), JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows.at(-1)));
}

const done = rows.filter((r) => r.status !== "error");
const costs = done.map((r) => r.costUsd as number);
const summary = {
  clean: `${rows.filter((r) => r.clean).length}/${rows.length}`,
  gate: rows.filter((r) => r.clean).length >= Math.ceil(rows.length * 0.9) ? "PASS" : "FAIL",
  avgCostUsd: costs.length ? +(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(5) : null,
  worstCaptionP95Ms: Math.max(...done.map((r) => r.captionP95Ms as number)),
  avgSeconds: +(rows.reduce((a, r) => a + (r.seconds as number), 0) / rows.length).toFixed(0),
};
writeFileSync(join(outRoot, "acceptance.json"), JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary));
if (!existsSync(join(outRoot, "acceptance.json"))) process.exit(3);
