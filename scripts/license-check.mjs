// Dependency license gate (constitution VI, spike T011).
// Production deps: DENY fails, REVIEW fails unless allowlisted in license-allowlist.json.
// Dev-only deps (never shipped): DENY/REVIEW are reported as warnings.
// Usage: node scripts/license-check.mjs [--json]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const DENY = /AGPL|SSPL|RSAL|BUSL|CC-BY-NC|Commons Clause|(^|[^L])GPL-[23]|^GPL/i;
const REVIEW = /UNKNOWN|Custom|UNLICENSED|SEE LICENSE|LGPL|MPL|CC-BY-SA|EPL|OFL/i;

const allow = JSON.parse(readFileSync(new URL("../license-allowlist.json", import.meta.url), "utf8"));
const allowed = (name, version) =>
  allow.packages.some((a) => a.name === name && (a.version === "*" || a.version === version));

function list(prod) {
  const args = ["licenses", "list", "--json", "-r", ...(prod ? ["--prod"] : [])];
  const out = execFileSync("pnpm", args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 64 << 20,
  });
  const data = out.trim() ? JSON.parse(out) : {};
  const rows = [];
  for (const [license, pkgs] of Object.entries(data))
    for (const p of pkgs) for (const v of p.versions) rows.push({ name: p.name, version: v, license });
  return rows;
}

/** An SPDX "A OR B" expression passes if any alternative passes. */
function classify(license) {
  const alts = license.replace(/[()]/g, "").split(/\s+OR\s+/i);
  const tags = alts.map((l) => (DENY.test(l) ? "deny" : REVIEW.test(l) ? "review" : "ok"));
  return tags.includes("ok") ? "ok" : tags.includes("review") ? "review" : "deny";
}

const prod = list(true);
const prodKeys = new Set(prod.map((r) => `${r.name}@${r.version}`));
const dev = list(false).filter((r) => !prodKeys.has(`${r.name}@${r.version}`));
const problems = [];
const warnings = [];
for (const r of prod) {
  const c = classify(r.license);
  if (c === "deny" || (c === "review" && !allowed(r.name, r.version))) problems.push({ ...r, class: c });
}
for (const r of dev) {
  const c = classify(r.license);
  if (c !== "ok" && !allowed(r.name, r.version)) warnings.push({ ...r, class: c });
}
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ prod: prod.length, dev: dev.length, problems, warnings }, null, 2));
} else {
  console.log(`license-check: ${prod.length} prod + ${dev.length} dev-only package versions`);
  for (const w of warnings)
    console.log(`  warn (dev) ${w.class.toUpperCase()} ${w.name}@${w.version}: ${w.license}`);
  for (const p of problems)
    console.log(`  FAIL ${p.class.toUpperCase()} ${p.name}@${p.version}: ${p.license}`);
  console.log(problems.length ? `license-check: FAILED (${problems.length})` : "license-check: OK");
}
process.exit(problems.length ? 1 : 0);
