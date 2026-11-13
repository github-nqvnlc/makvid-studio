// M4 check (T116): a real Vietnamese voice (FPT TTS of a known text) packed as an MP4 video is ingested with the
// real worker-align (whisper.cpp + MFA). Reports recognition accuracy (word error rate vs the known text) and
// timing sanity. Usage: pnpm --filter @makvid/cli exec node --env-file=../../.env --import tsx scripts/m4-media-check.ts <outDir>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ingestMedia } from "@makvid/media";
import { FptTtsProvider, MfaAligner } from "@makvid/tts";

const out = process.argv[2] ?? "m4-media";
mkdirSync(out, { recursive: true });
const TEXT = [
  "Xin chào các bạn, hôm nay mình chia sẻ ba mẹo tiết kiệm tiền.",
  "Thứ nhất, hãy ghi lại mọi khoản chi tiêu trong một tuần.",
  "Thứ hai, để dành ít nhất mười phần trăm thu nhập ngay khi nhận lương.",
  "Cuối cùng, đặt một mục tiêu cụ thể để có động lực mỗi ngày.",
];
const key = process.env.FPT_AI_API_KEY;
if (!key) throw new Error("FPT_AI_API_KEY is not set");
const r = await new FptTtsProvider(key).synthesize({ text: TEXT.join(" "), voiceId: "vits:leminh" });
const wav = join(out, "voice.wav");
writeFileSync(wav, r.audio);
const mp4 = join(out, "talk.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=640x360:r=25", "-i", wav, "-shortest", "-c:v", "libx264", "-c:a", "aac", mp4]);

const t0 = performance.now();
const src = await ingestMedia(mp4, { speech: new MfaAligner(), workDir: join(out, "work") });
const seconds = (performance.now() - t0) / 1000;

const norm = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
const ref = norm(TEXT.join(" "));
const hyp = norm(src.sentences!.join(" "));
// Word error rate (Levenshtein on words).
const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)] as number[]);
for (let j = 1; j <= hyp.length; j++) d[0]![j] = j;
for (let i = 1; i <= ref.length; i++)
  for (let j = 1; j <= hyp.length; j++)
    d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
const wer = d[ref.length]![hyp.length]! / ref.length;
const words = src.transcript!;
const monotonic = words.every((w, i) => w.endMs >= w.startMs && (i === 0 || w.startMs >= words[i - 1]!.startMs));
const report = {
  durationSec: src.metadata.durationSec,
  processingSec: Math.round(seconds * 10) / 10,
  segments: src.metadata.segments,
  sentences: src.sentences,
  wer: Math.round(wer * 1000) / 10,
  words: words.length,
  monotonicTimings: monotonic,
  firstWords: words.slice(0, 6),
};
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
