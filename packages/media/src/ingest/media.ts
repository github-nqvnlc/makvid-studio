// Audio / video ingest (T116, ADR 0010): extract 16 kHz mono speech audio (ffmpeg), recognise it with whisper.cpp
// (segments with coarse times), then time every word with MFA per segment and map the timings back onto the
// displayed words (case, diacritics and punctuation kept for captions). The result can drive a normal
// production (narration rewritten by the AI) or, with `useAsNarration`, keep the original voice: the
// transcript becomes the narration verbatim and the source audio is the voice track.
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  mapAlignedWords,
  readWav,
  writeWav,
  type AlignUtterance,
  type TimedWord,
  type TranscriptSegment,
} from "@makvid/tts";
import { splitSentences } from "./script";
import { cleanText, type SourceMaterial } from "./types";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

/** What the ingest needs from worker-align (MfaAligner implements it). */
export interface SpeechServices {
  transcribe(wav16k: Buffer, opts?: { language?: string; prompt?: string }): Promise<TranscriptSegment[]>;
  alignMany(utts: AlignUtterance[]): Promise<Map<string, TimedWord[]>>;
}

export interface MediaIngestOptions {
  speech: SpeechServices;
  /** Where the extracted audio is written (kept for "use as narration"). */
  workDir: string;
  maxSeconds?: number; // default 300 (5 minutes)
  /** Optional names / terms that help recognition (whisper prompt). */
  hint?: string;
  title?: string;
}

export async function mediaDurationSec(file: string): Promise<number> {
  const { stdout } = await run(FFPROBE, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const d = Number(stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error("the file has no readable audio");
  return d;
}

/** Cut [startMs, endMs) out of a mono 16-bit WAV. */
function sliceWav(wav: Buffer, startMs: number, endMs: number): Buffer {
  const pcm = readWav(wav);
  const a = Math.max(0, Math.floor((startMs / 1000) * pcm.sampleRate));
  const b = Math.min(pcm.samples.length, Math.ceil((endMs / 1000) * pcm.sampleRate));
  return writeWav({ sampleRate: pcm.sampleRate, samples: pcm.samples.slice(a, Math.max(a + 1, b)) });
}

export async function ingestMedia(file: string, o: MediaIngestOptions): Promise<SourceMaterial> {
  const duration = await mediaDurationSec(file);
  const max = o.maxSeconds ?? 300;
  if (duration > max) throw new Error(`the file is ${Math.round(duration)} s long (max ${max} s)`);
  mkdirSync(o.workDir, { recursive: true });
  // Speech track for recognition/alignment (16 kHz mono) and a 44.1 kHz copy usable as narration.
  const speech16k = join(o.workDir, "source-16k.wav");
  const narration = join(o.workDir, "source-narration.wav");
  await run(FFMPEG, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    file,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    speech16k,
  ]);
  await run(FFMPEG, [
    "-y",
    "-loglevel",
    "error",
    "-i",
    file,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "44100",
    "-c:a",
    "pcm_s16le",
    narration,
  ]);
  const wav = readFileSync(speech16k);

  const segments = (
    await o.speech.transcribe(wav, { language: "vi", ...(o.hint ? { prompt: o.hint } : {}) })
  ).filter((s) => s.text.trim() && s.endMs > s.startMs);
  if (!segments.length) throw new Error("no speech found in the file");

  // Time every word with MFA, one utterance per whisper segment (short utterances align reliably).
  const utts = segments.map((s, i) => ({
    id: `s${i}`,
    wav: sliceWav(wav, s.startMs, s.endMs),
    text: s.text,
  }));
  const aligned = await o.speech.alignMany(utts);
  const words: TimedWord[] = segments.flatMap((s, i) => {
    const display = s.text.normalize("NFC").split(/\s+/).filter(Boolean);
    return mapAlignedWords(display, aligned.get(`s${i}`) ?? [], s.endMs - s.startMs).map((w) => ({
      text: w.text,
      startMs: s.startMs + w.startMs,
      endMs: s.startMs + w.endMs,
    }));
  });

  const text = cleanText(segments.map((s) => s.text).join(" "), 20_000);
  const sentences = splitSentences(text);
  return {
    kind: "media",
    markdown: cleanText(`Lời thoại từ file âm thanh/video (${Math.round(duration)} giây):\n\n${text}`),
    ...(o.title ? { title: o.title.normalize("NFC") } : {}),
    sentences,
    transcript: words,
    audioFile: narration,
    metadata: { durationSec: Math.round(duration * 10) / 10, segments: segments.length, words: words.length },
  };
}
