// "Use the source audio as narration" (T116): instead of TTS, the voice track is cut from the uploaded audio,
// sentence by sentence, using the MFA word timings of the transcript. Only the sentences still in the spec are
// kept (a scene dropped in review or by chat also drops its audio), joined with short pauses.
import { readFileSync } from "node:fs";
import type { SourceMaterial } from "@makvid/media";
import type { VideoSpec } from "@makvid/spec";
import { concatPcm, readWav, writeWav, type Narration, type NarrationWord } from "@makvid/tts";

const LEAD_IN_MS = 80;
const TAIL_MS = 140;
const GAP_MS = 250;

/** Word ranges of each source sentence (sentences were split from the same transcript text). */
export function sentenceWordRanges(
  sentences: string[],
  words: Array<{ text: string }>,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let k = 0;
  for (const s of sentences) {
    const n = s.split(/\s+/).filter(Boolean).length;
    out.push([k, Math.min(words.length, k + n)]);
    k += n;
  }
  return out;
}

export function narrationFromSource(
  spec: VideoSpec,
  source: SourceMaterial,
): Omit<Narration, "chars" | "costUsd"> {
  if (!source.audioFile || !source.transcript?.length || !source.sentences?.length)
    throw new Error("the source has no transcript audio");
  const pcm = readWav(readFileSync(source.audioFile));
  const ranges = sentenceWordRanges(source.sentences, source.transcript);
  const pieces: Array<{ scriptId: string; from: number; to: number; words: typeof source.transcript }> = [];
  for (const line of spec.script) {
    const idx = Number(/^s(\d+)$/.exec(line.id)?.[1] ?? 0) - 1;
    const r = ranges[idx];
    if (!r || r[1] <= r[0]) continue;
    const ws = source.transcript.slice(r[0], r[1]);
    pieces.push({
      scriptId: line.id,
      from: Math.max(0, ws[0]!.startMs - LEAD_IN_MS),
      to: ws[ws.length - 1]!.endMs + TAIL_MS,
      words: ws,
    });
  }
  if (!pieces.length) throw new Error("no narration left to keep");
  const rate = pcm.sampleRate;
  const cut = (a: number, b: number) =>
    pcm.samples.slice(
      Math.floor((a / 1000) * rate),
      Math.min(pcm.samples.length, Math.ceil((b / 1000) * rate)),
    );
  const { pcm: joined, onsetsMs } = concatPcm(
    pieces.map((p) => ({ pcm: { sampleRate: rate, samples: cut(p.from, p.to) }, gapAfterMs: GAP_MS })),
  );
  const words: NarrationWord[] = [];
  const parts: Narration["parts"] = [];
  pieces.forEach((p, i) => {
    const shift = onsetsMs[i]! - p.from;
    for (const w of p.words)
      words.push({
        text: w.text,
        startMs: Math.round(w.startMs + shift),
        endMs: Math.round(w.endMs + shift),
        scriptId: p.scriptId,
      });
    parts.push({
      scriptId: p.scriptId,
      startMs: Math.round(onsetsMs[i]!),
      endMs: Math.round(onsetsMs[i]! + p.to - p.from),
    });
  });
  return {
    wav: writeWav(joined),
    durationMs: Math.round((joined.samples.length / rate) * 1000),
    words,
    parts,
  };
}
