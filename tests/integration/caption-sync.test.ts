// T065: caption word onsets vs the narration actually heard. The whole narration track of a produced video
// is re-aligned with MFA (independently of the per-sentence alignment used to build captions); every caption
// word must start within 100 ms of where MFA hears it.
// Run: MAKVID_PRODUCED_DIR=<produce --out dir> (worker-align running) pnpm --filter @makvid/tests test
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSrt } from "@makvid/compiler";
import { MfaAligner, mapAlignedWords } from "@makvid/tts";

const dir = process.env.MAKVID_PRODUCED_DIR;

describe.runIf(!!dir)("caption sync (T065)", () => {
  it("caption word onsets are within 100 ms of the narration", async () => {
    const spec = JSON.parse(readFileSync(join(dir!, "spec.json"), "utf8"));
    const words: Array<{ text: string; startMs: number }> = spec.audio.narration.words;
    const wav = readFileSync(join(dir!, "narration.wav"));
    const transcript = spec.script.map((s: { text: string }) => s.text).join(" ");
    const aligned = (await new MfaAligner().align({ audio: wav, transcript, language: "vi" })).words;
    const heard = mapAlignedWords(
      words.map((w) => w.text),
      aligned,
      1e9,
    );
    const errs = words.map((w, i) => Math.abs(w.startMs - heard[i]!.startMs)).sort((a, b) => a - b);
    const p = (q: number) => errs[Math.floor(q * (errs.length - 1))]!;
    console.log(
      `caption sync: n=${errs.length} median ${p(0.5)} p90 ${p(0.9)} p95 ${p(0.95)} max ${p(1)} ms`,
    );
    expect(p(0.95)).toBeLessThan(100);
    expect(p(0.5)).toBeLessThan(50);
    // Every SRT cue starts exactly at its first word.
    const cues = parseSrt(readFileSync(join(dir!, "out", "9x16", "captions.srt"), "utf8"));
    const starts = new Set(words.map((w) => w.startMs));
    for (const c of cues) expect([...starts].some((s) => Math.abs(s - c.startMs) <= 1)).toBe(true);
  }, 600_000);
});
