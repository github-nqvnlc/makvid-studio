// T066: integrated loudness −14 LUFS ±1 and music ducking while the voice speaks.
// Voice = 300 Hz tone; the music level is measured with that band removed, during speech vs during a pause.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { measureLoudness, mixAudio, musicPath, pickMusic } from "@makvid/media";

const levelWithoutVoice = (file: string, fromS: number, durS: number) =>
  spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-ss",
      String(fromS),
      "-t",
      String(durS),
      "-i",
      file,
      "-af",
      "bandreject=f=300:width_type=h:w=120,bandreject=f=600:width_type=h:w=120,astats=metadata=0",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" },
  ).stderr;

describe.runIf(process.env.MAKVID_RENDER_TESTS === "1" || process.env.MAKVID_AUDIO_TESTS === "1")(
  "audio mix (T066)",
  () => {
    it("normalizes to −14 LUFS ±1 and ducks music under the voice", async () => {
      const dir = mkdtempSync(join(tmpdir(), "mkv-mix-"));
      const voice = join(dir, "voice.wav");
      // 3 s voice, 3 s pause, 3 s voice
      execFileSync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=f=300:d=3",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=44100:cl=mono:d=3",
        "-f",
        "lavfi",
        "-i",
        "sine=f=300:d=3",
        "-filter_complex",
        "[0][1][2]concat=n=3:v=0:a=1,volume=-10dB",
        voice,
      ]);
      const r = await mixAudio({
        narrationWav: voice,
        durationMs: 9500,
        musicFile: musicPath(pickMusic({ moods: ["calm"] })),
        outWav: join(dir, "mix.wav"),
      });
      expect(Math.abs(r.integratedLufs - -14)).toBeLessThanOrEqual(1);
      expect(r.truePeakDb).toBeLessThanOrEqual(-1);
      const m = await measureLoudness(r.outWav);
      expect(Math.abs(m.integrated - -14)).toBeLessThanOrEqual(1);
      const rms = (s: string) => Number(/Overall[\s\S]*?RMS level dB:\s+(-?[\d.]+)/.exec(s)?.[1] ?? NaN);
      const speech = rms(levelWithoutVoice(r.outWav, 1.0, 1.5));
      const pause = rms(levelWithoutVoice(r.outWav, 4.0, 1.5));
      console.log(`music level: under voice ${speech.toFixed(1)} dB, in pause ${pause.toFixed(1)} dB`);
      expect(pause - speech).toBeGreaterThan(6);
    }, 120_000);
  },
);
