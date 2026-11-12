// Score MFA word onsets against ground truth (gt corpus) and compare with the energy method (nat corpus).
// Usage: node eval.mjs corpus/<voice>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const words = (file) => {
  const j = JSON.parse(readFileSync(file, "utf8"));
  return j.tiers.words.entries.filter((e) => e[2] && e[2] !== "<eps>" && e[2] !== "spn").map((e) => ({ start: e[0] * 1000, end: e[1] * 1000, w: e[2] }));
};
const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
const stats = (a) => `median ${q(a, 0.5).toFixed(0)} · p90 ${q(a, 0.9).toFixed(0)} · max ${q(a, 1).toFixed(0)} ms · ≤100 ms: ${a.filter((x) => x <= 100).length}/${a.length}`;

// 1) MFA vs exact ground truth (words synthesized separately, onsets known).
const gt = JSON.parse(readFileSync(join(dir, "gt.json"), "utf8"));
const eGt = [];
let missing = 0;
for (const id of Object.keys(gt)) {
  const w = words(join(dir, "gt-out", `${id}.json`));
  if (w.length !== gt[id].length) missing += Math.abs(w.length - gt[id].length);
  gt[id].forEach((t, i) => w[i] && eGt.push(Math.abs(w[i].start - t)));
}
console.log(`MFA vs ground truth (separately synthesized words): ${stats(eGt)}${missing ? ` · word-count mismatches ${missing}` : ""}`);

// 2) Natural chunks: MFA vs energy-dip method (no exact truth; shows how far the cheap method is from MFA).
const nrg = JSON.parse(readFileSync(join(dir, "nat-energy.json"), "utf8"));
const eNat = [];
for (const f of readdirSync(join(dir, "nat-out")).filter((f) => f.endsWith(".json"))) {
  const id = f.replace(".json", "");
  const w = words(join(dir, "nat-out", f));
  nrg[id]?.forEach((t, i) => i > 0 && w[i] && eNat.push(Math.abs(w[i].start - t)));
}
console.log(`Natural chunks, energy method vs MFA: ${stats(eNat)}`);
