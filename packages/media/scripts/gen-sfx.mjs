// Procedural SFX (project-owned, no third-party license): whoosh, pop, click, rise.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "library", "sfx");
mkdirSync(out, { recursive: true });
const RATE = 44100;
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const SFX = {
  whoosh: {
    ms: 450,
    f: (t, d) => {
      const p = t / d;
      let y = 0;
      return () => {
        y = 0.85 * y + 0.15 * rnd();
        return y * Math.sin(Math.PI * p) * 1.6;
      };
    },
  },
  pop: {
    ms: 160,
    f: (t) => () => Math.sin(2 * Math.PI * (600 + 900 * Math.exp(-t * 40)) * t) * Math.exp(-t * 28),
  },
  click: { ms: 60, f: (t) => () => Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 120) },
  rise: {
    ms: 700,
    f: (t, d) => () =>
      Math.sin(2 * Math.PI * (200 + 900 * (t / d) ** 2) * t) * Math.min(1, t / 0.05) * (1 - t / d) * 0.7,
  },
};
const manifest = [];
for (const [id, s] of Object.entries(SFX)) {
  const n = Math.round((RATE * s.ms) / 1000);
  const d = s.ms / 1000;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s.f(t, d)() * 0.6)) * 32767), 44 + i * 2);
  }
  const tmp = join(out, `${id}.wav`);
  writeFileSync(tmp, buf);
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    tmp,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-fflags",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-map_metadata",
    "-1",
    join(out, `${id}.m4a`),
  ]);
  rmSync(tmp);
  manifest.push({
    id,
    kind: id,
    pack: "common",
    file: `${id}.m4a`,
    durationMs: s.ms,
    license: {
      source: "MakVid Studio (procedural, packages/media/scripts/gen-sfx.mjs)",
      terms: "Owned by the project",
      attribution: null,
    },
  });
}
writeFileSync(join(out, "manifest.json"), JSON.stringify({ sfx: manifest }, null, 2) + "\n");
console.log(manifest.map((m) => m.file).join(" "));
