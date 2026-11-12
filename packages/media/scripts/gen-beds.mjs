// Generate the built-in background music beds procedurally (deterministic additive synthesis), so the
// library has no third-party license. Usage: node packages/media/scripts/gen-beds.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "library", "music");
mkdirSync(out, { recursive: true });
const RATE = 44100;
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Chord progressions (MIDI notes) per mood.
const BEDS = [
  {
    id: "calm-pads",
    title: "Calm pads",
    moods: ["calm", "corporate"],
    bpm: 72,
    seconds: 64,
    prog: [
      [48, 55, 60, 64, 71],
      [45, 52, 57, 60, 67],
      [41, 48, 53, 57, 64],
      [43, 50, 55, 59, 62],
    ],
    pulse: 0,
    hats: 0,
    bright: 0.25,
  },
  {
    id: "corporate-pulse",
    title: "Corporate pulse",
    moods: ["corporate", "tech", "calm"],
    bpm: 100,
    seconds: 64,
    prog: [
      [50, 57, 62, 66, 69],
      [47, 54, 59, 62, 66],
      [43, 50, 55, 59, 62],
      [45, 52, 57, 61, 64],
    ],
    pulse: 0.35,
    hats: 0.04,
    bright: 0.4,
  },
  {
    id: "upbeat-drive",
    title: "Upbeat drive",
    moods: ["energetic", "upbeat", "tech"],
    bpm: 118,
    seconds: 64,
    prog: [
      [45, 52, 57, 60, 64],
      [41, 48, 53, 57, 60],
      [48, 55, 60, 64, 67],
      [43, 50, 55, 59, 62],
    ],
    pulse: 0.55,
    hats: 0.07,
    bright: 0.55,
  },
];

function render(b) {
  const n = RATE * b.seconds;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const beat = 60 / b.bpm;
  const chordLen = beat * 4;
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const ci = Math.floor(t / chordLen) % b.prog.length;
    const tc = t % chordLen;
    // Pad: soft attack/release per chord, detuned pairs for width.
    const env = Math.min(1, tc / 0.6) * Math.min(1, (chordLen - tc) / 0.5);
    let l = 0;
    let r = 0;
    for (const [k, note] of b.prog[ci].entries()) {
      const f = midi(note);
      const amp = (k === 0 ? 0.5 : 0.28) * (1 + 0.1 * Math.sin(2 * Math.PI * 0.2 * t + k));
      const base = Math.sin(2 * Math.PI * f * t) + b.bright * 0.35 * Math.sin(2 * Math.PI * 2 * f * t);
      l += amp * (base + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t));
      r += amp * (base + 0.5 * Math.sin(2 * Math.PI * f * 0.997 * t));
    }
    l *= 0.11 * env;
    r *= 0.11 * env;
    // Pulse: low "thump" on each beat.
    if (b.pulse) {
      const tb = t % beat;
      const k = Math.exp(-tb * 18) * Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-tb * 30)) * tb);
      l += b.pulse * 0.5 * k;
      r += b.pulse * 0.5 * k;
    }
    // Hats: short noise on off-beats.
    if (b.hats) {
      const th = (t + beat / 2) % beat;
      const h = th < 0.03 ? rnd() * Math.exp(-th * 150) : 0;
      l += b.hats * h;
      r += b.hats * h * 0.8;
    }
    // Global fade in/out so the bed loops/cuts cleanly.
    const g = Math.min(1, t / 1.5) * Math.min(1, (b.seconds - t) / 1.5);
    L[i] = l * g;
    R[i] = r * g;
  }
  return [L, R];
}

function wav([L, R]) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write("WAVEfmt ", 8, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4);
  }
  return buf;
}

const manifest = [];
for (const b of BEDS) {
  const tmp = join(out, `${b.id}.wav`);
  writeFileSync(tmp, wav(render(b)));
  const file = `${b.id}.m4a`;
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    tmp,
    "-af",
    "loudnorm=I=-20:TP=-2",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-fflags",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-map_metadata",
    "-1",
    join(out, file),
  ]);
  rmSync(tmp);
  manifest.push({
    id: b.id,
    title: b.title,
    file,
    durationMs: b.seconds * 1000,
    bpm: b.bpm,
    moods: b.moods,
    loop: true,
    license: {
      source: "MakVid Studio (procedurally generated, packages/media/scripts/gen-beds.mjs)",
      terms: "Owned by the project; no third-party rights",
      attribution: null,
    },
  });
  console.log(`music/${file}`);
}
writeFileSync(join(out, "manifest.json"), JSON.stringify({ tracks: manifest }, null, 2) + "\n");
