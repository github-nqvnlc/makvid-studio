// T108a: generate one short preview clip per voice (MP3, ~5 s) + manifest.json for the voice picker.
// Run: pnpm exec tsx --env-file=.env packages/tts/scripts/gen-voice-previews.ts [--force]
// Costs a few cents (one sample sentence per voice). Existing clips are kept unless --force.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FptTtsProvider } from "../src/providers/fpt";
import { PREVIEW_TEXT, type VoicePreview } from "../src/voices";

const out = join(dirname(fileURLToPath(import.meta.url)), "../library/voices");
const force = process.argv.includes("--force");
const key = process.env.FPT_AI_API_KEY;
if (!key) throw new Error("FPT_AI_API_KEY is not set (.env)");
const tts = new FptTtsProvider(key);
mkdirSync(out, { recursive: true });

const manifest: VoicePreview[] = [];
let cost = 0;
for (const v of await tts.listVoices()) {
  const file = `${v.id.replace(":", "-")}.mp3`;
  const dest = join(out, file);
  if (force || !existsSync(dest)) {
    const r = await tts.synthesize({ text: PREVIEW_TEXT, voiceId: v.id });
    cost += r.costUsd ?? 0;
    const wav = join(out, ".tmp.wav");
    writeFileSync(wav, r.audio);
    const ff = spawnSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      wav,
      "-ac",
      "1",
      "-ar",
      "44100",
      "-b:a",
      "64k",
      dest,
    ]);
    unlinkSync(wav);
    if (ff.status !== 0) throw new Error(`ffmpeg failed for ${v.id}: ${String(ff.stderr)}`);
    process.stdout.write(`  ${v.id} -> ${file}\n`);
  }
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dest],
    {
      encoding: "utf8",
    },
  );
  manifest.push({ ...v, file, durationMs: Math.round(Number(probe.stdout.trim()) * 1000) });
}
const path = join(out, "manifest.json");
const prev = existsSync(path) ? readFileSync(path, "utf8") : "";
const next = JSON.stringify({ text: PREVIEW_TEXT, voices: manifest }, null, 2) + "\n";
if (next !== prev) writeFileSync(path, next);
process.stdout.write(`${manifest.length} voices, synthesis cost $${cost.toFixed(4)}\n`);
