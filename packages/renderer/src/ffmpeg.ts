// FFmpeg helpers (FFmpeg is a separate process, never linked; see THIRD_PARTY_LICENSES.md).
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
export const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
export const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

export async function ffmpeg(args: string[]): Promise<string> {
  const { stdout } = await run(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args], {
    maxBuffer: 256 << 20,
  });
  return stdout;
}

export async function probe(file: string): Promise<{
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  frames: number;
  vcodec: string;
  pixFmt: string;
  acodec: string | null;
}> {
  const { stdout } = await run(
    FFPROBE,
    [
      "-v",
      "error",
      "-count_frames",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt:format=duration",
      "-of",
      "json",
      file,
    ],
    { maxBuffer: 64 << 20 },
  );
  const j = JSON.parse(stdout) as {
    streams: Array<{
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      nb_read_frames?: string;
      pix_fmt?: string;
    }>;
    format: { duration: string };
  };
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  if (!v) throw new Error(`${file}: no video stream`);
  const [n, d] = (v.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    durationSec: Number(j.format.duration),
    width: v.width ?? 0,
    height: v.height ?? 0,
    fps: d ? n! / d : 0,
    frames: Number(v.nb_read_frames ?? 0),
    vcodec: v.codec_name,
    pixFmt: v.pix_fmt ?? "",
    acodec: a?.codec_name ?? null,
  };
}

/** Per-frame MD5 of the decoded video (ffmpeg framemd5): proves frame-level determinism across runs. */
export async function frameHashes(file: string): Promise<string[]> {
  const out = await ffmpeg(["-i", file, "-map", "0:v:0", "-f", "framemd5", "-"]);
  return out
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").pop()!.trim());
}

/** Mean SSIM (All) between two videos or two images of the same size. */
export async function ssim(a: string, b: string): Promise<number> {
  const { stderr } = await run(
    FFMPEG,
    ["-hide_banner", "-loglevel", "info", "-i", a, "-i", b, "-lavfi", "[0:v][1:v]ssim", "-f", "null", "-"],
    {
      maxBuffer: 64 << 20,
    },
  );
  const m = /SSIM .*All:([\d.]+)/.exec(stderr);
  if (!m) throw new Error(`ssim: no result for ${a} vs ${b}`);
  return Number(m[1]);
}

/** Spawn ffmpeg reading PNG frames from stdin; resolves when encoding finishes. */
export function pngPipeEncoder(
  fps: number,
  outPath: string,
): { write: (png: Buffer) => Promise<void>; end: () => Promise<void> } {
  const p = spawn(
    FFMPEG,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-c:v",
      "png",
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "16",
      "-pix_fmt",
      "yuv420p",
      "-fflags",
      "+bitexact",
      "-flags:v",
      "+bitexact",
      "-map_metadata",
      "-1",
      "-movflags",
      "+faststart",
      outPath,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let stderr = "";
  let pipeError: Error | null = null;
  p.stderr.on("data", (d) => (stderr += String(d)));
  p.stdin.on("error", (e) => (pipeError = e));
  const done = new Promise<void>((resolve, reject) => {
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`)),
    );
  });
  return {
    write: (png) =>
      new Promise((resolve, reject) => {
        if (pipeError) return reject(pipeError);
        if (p.stdin.write(png)) resolve();
        else p.stdin.once("drain", () => resolve());
      }),
    end: async () => {
      p.stdin.end();
      await done;
    },
  };
}
