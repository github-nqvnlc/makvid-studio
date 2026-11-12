// Narration builder: synthesize each script sentence, trim, concatenate with pauses, align with MFA
// (one aligner call per video) and return a WAV + script-relative word timings.
import { splitWords } from "@makvid/style-kit";
import { mapAlignedWords, type MfaAligner } from "./aligner";
import type { TtsProvider } from "./types";
import { concatPcm, readWav, trimSilence, writeWav, type Pcm } from "./wav";

export interface NarrationPart {
  scriptId: string;
  text: string;
}

export interface NarrationWord {
  text: string;
  startMs: number;
  endMs: number;
  scriptId: string;
}

export interface Narration {
  wav: Buffer;
  durationMs: number;
  words: NarrationWord[];
  parts: Array<{ scriptId: string; startMs: number; endMs: number }>;
  chars: number;
  costUsd: number;
}

/** Pause after a sentence, by its final punctuation. */
const pauseAfter = (text: string) =>
  /[.!?…]$/.test(text.trim()) ? 380 : /[,;:]$/.test(text.trim()) ? 220 : 300;

export async function narrate(
  parts: NarrationPart[],
  opts: {
    tts: TtsProvider;
    aligner: MfaAligner;
    voiceId: string;
    speed?: number;
    leadMs?: number;
    concurrency?: number;
  },
): Promise<Narration> {
  const lead = opts.leadMs ?? 250;
  const conc = opts.concurrency ?? 4;
  const synths: Array<{ pcm: Pcm; raw: Buffer; chars: number; cost: number }> = new Array(parts.length);
  for (let i = 0; i < parts.length; i += conc) {
    await Promise.all(
      parts.slice(i, i + conc).map(async (p, k) => {
        const r = await opts.tts.synthesize({
          text: p.text,
          voiceId: opts.voiceId,
          ...(opts.speed ? { speed: opts.speed } : {}),
        });
        const t = trimSilence(readWav(r.audio));
        synths[i + k] = { pcm: t.pcm, raw: writeWav(t.pcm), chars: r.chars, cost: r.costUsd ?? 0 };
      }),
    );
  }
  const cat = concatPcm(
    synths.map((s, i) => ({
      pcm: s.pcm,
      gapAfterMs: i === synths.length - 1 ? 400 : pauseAfter(parts[i]!.text),
    })),
    lead,
  );
  const aligned = await opts.aligner.alignMany(
    parts.map((p, i) => ({ id: `p${i}`, wav: synths[i]!.raw, text: p.text })),
  );
  const words: NarrationWord[] = [];
  const spans = parts.map((p, i) => {
    const startMs = Math.round(cat.onsetsMs[i]!);
    const lenMs = (synths[i]!.pcm.samples.length / synths[i]!.pcm.sampleRate) * 1000;
    const local = mapAlignedWords(splitWords(p.text), aligned.get(`p${i}`) ?? [], lenMs);
    for (const w of local)
      words.push({
        text: w.text,
        startMs: startMs + w.startMs,
        endMs: startMs + w.endMs,
        scriptId: p.scriptId,
      });
    return { scriptId: p.scriptId, startMs, endMs: Math.round(startMs + lenMs) };
  });
  return {
    wav: writeWav(cat.pcm),
    durationMs: Math.round((cat.pcm.samples.length / cat.pcm.sampleRate) * 1000),
    words,
    parts: spans,
    chars: synths.reduce((a, s) => a + s.chars, 0),
    costUsd: Math.round(synths.reduce((a, s) => a + s.cost, 0) * 1e6) / 1e6,
  };
}
