// M0 spike T011: summarize a license-checker JSON and flag denied / unknown licenses.
// Usage: node summarize.mjs <license-checker.json>
import { readFileSync } from "node:fs";

const DENY = /AGPL|SSPL|RSAL|BUSL|CC-BY-NC|Commons Clause|(^|[^L])GPL-[23]/i;
const REVIEW = /UNKNOWN|Custom|UNLICENSED|SEE LICENSE|LGPL|MPL|CC-BY-SA|EPL|OFL/i;

const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const byLicense = new Map();
for (const [pkg, info] of Object.entries(data)) {
  const lic = Array.isArray(info.licenses) ? info.licenses.join(" | ") : String(info.licenses);
  if (!byLicense.has(lic)) byLicense.set(lic, []);
  byLicense.get(lic).push(pkg);
}
console.log(`packages: ${Object.keys(data).length}`);
let denied = 0;
for (const [lic, pkgs] of [...byLicense].sort((a, b) => b[1].length - a[1].length)) {
  const tag = DENY.test(lic) ? "DENY  " : REVIEW.test(lic) ? "REVIEW" : "ok    ";
  if (tag === "DENY  ") denied += pkgs.length;
  const list = tag === "ok    " ? "" : `  -> ${pkgs.join(", ")}`;
  console.log(`${tag} ${lic}: ${pkgs.length}${list}`);
}
process.exit(denied ? 1 : 0);
