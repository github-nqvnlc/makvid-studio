// Build a contact sheet (grid) from QA checkpoint PNGs: one frame per scene (the latest checkpoint).
// Usage: node scripts/contact-sheet.mjs <qaDir> <out.png> [cols=4] [scale=0.25]
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const [dir, out, colsArg = "4", scaleArg = "0.25"] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: contact-sheet.mjs <qaDir> <out.png> [cols] [scale]");
const byScene = new Map();
for (const f of readdirSync(dir)
  .filter((f) => f.endsWith(".png"))
  .sort()) {
  const m = /^(\d+-[^-]+(?:-[^-]+)*?)-(\d+)ms\.png$/.exec(f);
  if (!m) continue;
  const prev = byScene.get(m[1]);
  if (!prev || Number(m[2]) > prev.t) byScene.set(m[1], { f, t: Number(m[2]) });
}
const files = [...byScene.keys()].sort().map((k) => join(dir, byScene.get(k).f));
const cols = Number(colsArg);
const n = files.length;
const layout = files
  .map((_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = c === 0 ? "0" : Array.from({ length: c }, (_, k) => `w${k}`).join("+");
    const y = r === 0 ? "0" : Array.from({ length: r }, (_, k) => `h${k * cols}`).join("+");
    return `${x}_${y}`;
  })
  .join("|");
const filter =
  files.map((_, i) => `[${i}:v]scale=iw*${scaleArg}:ih*${scaleArg}[s${i}];`).join("") +
  files.map((_, i) => `[s${i}]`).join("") +
  `xstack=inputs=${n}:layout=${layout}:fill=black`;
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  ...files.flatMap((f) => ["-i", f]),
  "-filter_complex",
  filter,
  out,
]);
console.log(`${out} (${n} scenes)`);
