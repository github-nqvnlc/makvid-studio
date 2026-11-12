// Scene concat + audio mux: 1080p H.264 yuv420p + AAC, faststart, bit-exact flags (no timestamps
// in metadata), so the same scene files always produce the same final MP4.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ffmpeg } from "./ffmpeg";

export interface MuxInput {
  scenes: string[]; // scene MP4s in order
  outPath: string;
  fps: number;
  /** Mixed narration/music track; when absent a silent stereo AAC track is added. */
  audioPath?: string;
}

export async function concatAndMux(input: MuxInput): Promise<void> {
  mkdirSync(dirname(input.outPath), { recursive: true });
  const list = `${input.outPath}.concat.txt`;
  writeFileSync(
    list,
    input.scenes.map((s) => `file '${resolve(s).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n") +
      "\n",
  );
  const audio = input.audioPath
    ? ["-i", input.audioPath]
    : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
  await ffmpeg([
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    list,
    ...audio,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(input.fps),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-shortest",
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
    "-flags:a",
    "+bitexact",
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    input.outPath,
  ]);
  rmSync(list, { force: true });
}

export async function thumbnail(video: string, atSec: number, outPath: string): Promise<void> {
  await ffmpeg(["-y", "-ss", String(atSec), "-i", video, "-frames:v", "1", "-q:v", "3", outPath]);
}
