// Built-in music/SFX library and the audio mix (narration + ducked music + SFX, 2-pass loudnorm).
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
export const LIBRARY_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "library");

export interface MusicTrack {
  id: string;
  title: string;
  file: string;
  durationMs: number;
  bpm: number;
  moods: string[];
  loop: boolean;
}
export interface SfxItem {
  id: string;
  kind: string;
  file: string;
  durationMs: number;
}

export function musicLibrary(): MusicTrack[] {
  return (
    JSON.parse(readFileSync(join(LIBRARY_DIR, "music", "manifest.json"), "utf8")) as { tracks: MusicTrack[] }
  ).tracks;
}
export function sfxLibrary(): SfxItem[] {
  return (JSON.parse(readFileSync(join(LIBRARY_DIR, "sfx", "manifest.json"), "utf8")) as { sfx: SfxItem[] })
    .sfx;
}
export const musicPath = (t: MusicTrack) => join(LIBRARY_DIR, "music", t.file);
export const sfxPath = (s: SfxItem) => join(LIBRARY_DIR, "sfx", s.file);

/** Pick a track: explicit id, else first matching mood (style pack moods), else the first track. */
export function pickMusic(opts: { trackId?: string; moods?: string[] }): MusicTrack {
  const lib = musicLibrary();
  if (opts.trackId) {
    const t = lib.find((x) => x.id === opts.trackId);
    if (t) return t;
  }
  for (const m of opts.moods ?? []) {
    const t = lib.find((x) => x.moods.includes(m));
    if (t) return t;
  }
  return lib[0]!;
}

export interface MixInput {
  narrationWav: string;
  durationMs: number;
  musicFile?: string;
  /** Music level under the voice before ducking, dB relative to library level. */
  musicGainDb?: number;
  sfx?: Array<{ file: string; atMs: number; gainDb?: number }>;
  outWav: string;
  targetLufs?: number;
}

export interface MixResult {
  outWav: string;
  integratedLufs: number;
  truePeakDb: number;
}

interface LoudnormStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

function filterGraph(inp: MixInput, tail: string): { args: string[]; graph: string } {
  const d = inp.durationMs / 1000;
  const args = ["-i", inp.narrationWav];
  let idx = 1;
  const parts: string[] = [
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=${d.toFixed(3)},atrim=0:${d.toFixed(3)},asplit=2[voice][sc]`,
  ];
  const mixIn = ["[voice]"];
  if (inp.musicFile) {
    args.push("-stream_loop", "-1", "-i", inp.musicFile);
    const fadeStart = Math.max(0, d - 1.5).toFixed(3);
    parts.push(
      `[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${d.toFixed(3)},volume=${inp.musicGainDb ?? -4}dB,afade=t=in:d=1,afade=t=out:st=${fadeStart}:d=1.5[mus]`,
      // Duck the music while the voice is present.
      `[mus][sc]sidechaincompress=threshold=0.005:ratio=8:attack=15:release=400:knee=1:makeup=1[ducked]`,
    );
    mixIn.push("[ducked]");
    idx++;
  } else parts.push("[sc]anullsink");
  for (const [k, s] of (inp.sfx ?? []).entries()) {
    args.push("-i", s.file);
    parts.push(
      `[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${s.gainDb ?? -8}dB,adelay=${Math.round(s.atMs)}|${Math.round(s.atMs)}[sfx${k}]`,
    );
    mixIn.push(`[sfx${k}]`);
    idx++;
  }
  parts.push(
    `${mixIn.join("")}amix=inputs=${mixIn.length}:normalize=0:duration=first,atrim=0:${d.toFixed(3)}${tail}`,
  );
  return { args, graph: parts.join(";") };
}

/** Mix and normalize to targetLufs (default -14) with a 2-pass loudnorm. */
export async function mixAudio(inp: MixInput): Promise<MixResult> {
  const target = inp.targetLufs ?? -14;
  const pass1 = filterGraph(inp, `,loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json[out]`);
  const r1 = await run(
    FFMPEG,
    [
      "-hide_banner",
      "-nostats",
      ...pass1.args,
      "-filter_complex",
      pass1.graph,
      "-map",
      "[out]",
      "-f",
      "null",
      "-",
    ],
    {
      maxBuffer: 64 << 20,
    },
  );
  const json = /\{[\s\S]*"target_offset"[\s\S]*?\}/.exec(r1.stderr);
  if (!json) throw new Error("loudnorm pass 1 produced no stats");
  const m = JSON.parse(json[0]) as LoudnormStats;
  const pass2 = filterGraph(
    inp,
    `,loudnorm=I=${target}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000[out]`,
  );
  await run(
    FFMPEG,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      ...pass2.args,
      "-filter_complex",
      pass2.graph,
      "-map",
      "[out]",
      "-c:a",
      "pcm_s16le",
      "-fflags",
      "+bitexact",
      inp.outWav,
    ],
    {
      maxBuffer: 64 << 20,
    },
  );
  const lm = await measureLoudness(inp.outWav);
  return { outWav: inp.outWav, integratedLufs: lm.integrated, truePeakDb: lm.truePeak };
}

/** EBU R128 integrated loudness and true peak of a file. */
export async function measureLoudness(file: string): Promise<{ integrated: number; truePeak: number }> {
  const r = await run(
    FFMPEG,
    ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { maxBuffer: 64 << 20 },
  );
  const i = /I:\s+(-?[\d.]+) LUFS/g;
  let last: RegExpExecArray | null = null;
  for (let m = i.exec(r.stderr); m; m = i.exec(r.stderr)) last = m;
  const tp = /Peak:\s+(-?[\d.]+) dBFS/g;
  let lastTp: RegExpExecArray | null = null;
  for (let m = tp.exec(r.stderr); m; m = tp.exec(r.stderr)) lastTp = m;
  return { integrated: Number(last?.[1] ?? NaN), truePeak: Number(lastTp?.[1] ?? NaN) };
}

/** Short-term RMS level (dBFS) of a file between two times — used to verify ducking. */
export async function levelDb(file: string, fromMs: number, toMs: number): Promise<number> {
  const r = await run(
    FFMPEG,
    [
      "-hide_banner",
      "-nostats",
      "-ss",
      String(fromMs / 1000),
      "-t",
      String((toMs - fromMs) / 1000),
      "-i",
      file,
      "-af",
      "astats=metadata=0:reset=0",
      "-f",
      "null",
      "-",
    ],
    { maxBuffer: 64 << 20 },
  );
  const m = /Overall[\s\S]*?RMS level dB:\s+(-?[\d.]+|-inf)/.exec(r.stderr);
  return m && m[1] !== "-inf" ? Number(m[1]) : -120;
}
