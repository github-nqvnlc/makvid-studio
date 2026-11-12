// LLM benchmark (M2 prep): every configured model writes a storyboard for each topic; outputs are scored
// automatically and copied into a blind folder for human rating.
// Usage: npx tsx --env-file=../../.env run.ts [--topics 3]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { score, type Score } from "./score";
import { SYSTEM_PROMPT, TOPICS, userPrompt } from "./task";
import { targets, type Target } from "./providers";

const OUT = join(import.meta.dirname, "out");
const nTopics = Number(process.argv[process.argv.indexOf("--topics") + 1]) || TOPICS.length;
const topics = TOPICS.slice(0, nTopics);

interface Row {
  provider: string;
  model: string;
  topic: number;
  ok: boolean;
  error?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  score?: Score;
}

async function runTarget(t: Target): Promise<Row[]> {
  const rows: Row[] = [];
  const dir = join(OUT, t.provider, t.model.replace(/[^\w.-]/g, "_"));
  mkdirSync(dir, { recursive: true });
  for (const [i, topic] of topics.entries()) {
    const t0 = performance.now();
    try {
      const c = await t.complete(SYSTEM_PROMPT, userPrompt(topic));
      const latencyMs = Math.round(performance.now() - t0);
      writeFileSync(join(dir, `${String(i + 1).padStart(2, "0")}.txt`), c.text);
      const costUsd = t.price ? (c.inputTokens * t.price.input + c.outputTokens * t.price.output) / 1e6 : null;
      rows.push({ provider: t.provider, model: t.model, topic: i, ok: true, latencyMs, inputTokens: c.inputTokens, outputTokens: c.outputTokens, costUsd, score: score(c.text) });
    } catch (e) {
      rows.push({ provider: t.provider, model: t.model, topic: i, ok: false, error: (e as Error).message.slice(0, 200), latencyMs: Math.round(performance.now() - t0), inputTokens: 0, outputTokens: 0, costUsd: null });
    }
    process.stdout.write(".");
  }
  return rows;
}

const ts = targets();
if (!ts.length) {
  console.log("No provider keys found (FPT_AI_API_KEY, OPENAI_API_KEY+OPENAI_MODELS, GEMINI_API_KEY+GEMINI_MODELS, ANTHROPIC_API_KEY).");
  process.exit(1);
}
console.log(`models: ${ts.map((t) => `${t.provider}:${t.model}`).join(", ")} · topics: ${topics.length}`);
const rows = (await Promise.all(ts.map(runTarget))).flat();
console.log();
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "results.json"), JSON.stringify(rows, null, 2));

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const summary = ts.map((t) => {
  const r = rows.filter((x) => x.provider === t.provider && x.model === t.model);
  const ok = r.filter((x) => x.ok && x.score?.parseOk);
  const valid = ok.filter((x) => x.score!.violations.length === 0 && x.score!.structureOk);
  const cost = r.map((x) => x.costUsd).filter((x): x is number => x !== null);
  return {
    model: `${t.provider}:${t.model}`,
    jsonOk: `${ok.length}/${r.length}`,
    fullyValid: `${valid.length}/${r.length}`,
    avgViolations: +mean(ok.map((x) => x.score!.violations.length)).toFixed(1),
    viRatio: +mean(ok.map((x) => x.score!.vietnameseRatio)).toFixed(2),
    foreign: ok.filter((x) => x.score!.foreignScript).length,
    over12Words: +mean(ok.map((x) => x.score!.onScreenWordsOver12)).toFixed(1),
    latencyS: +(mean(r.filter((x) => x.ok).map((x) => x.latencyMs)) / 1000).toFixed(1),
    outTokens: Math.round(mean(r.filter((x) => x.ok).map((x) => x.outputTokens))),
    costPerStoryboardUsd: cost.length ? +mean(cost).toFixed(5) : null,
    errors: r.filter((x) => !x.ok).length,
  };
});
writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.table(summary);

// Blind folder: same topic, shuffled model labels (deterministic seed), key kept separately.
const blind = join(OUT, "blind");
mkdirSync(blind, { recursive: true });
let seed = 20261112;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const key: Record<string, string> = {};
topics.forEach((_, i) => {
  const cands = rows.filter((x) => x.topic === i && x.ok);
  const order = cands.map((c) => ({ c, k: rnd() })).sort((a, b) => a.k - b.k);
  order.forEach(({ c }, j) => {
    const label = `topic${String(i + 1).padStart(2, "0")}-${String.fromCharCode(65 + j)}`;
    key[label] = `${c.provider}:${c.model}`;
    const src = join(OUT, c.provider, c.model.replace(/[^\w.-]/g, "_"), `${String(i + 1).padStart(2, "0")}.txt`);
    writeFileSync(join(blind, `${label}.txt`), `Chủ đề: ${topics[i]}\n\n` + readFileSync(src, "utf8"));
  });
});
writeFileSync(join(OUT, "blind-key.json"), JSON.stringify(key, null, 2));

