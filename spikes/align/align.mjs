// M0 spike T009: measure whisper.cpp word-onset error on Vietnamese audio with known ground truth.
// Ground truth: each word synthesized separately (espeak-ng vi), silence-trimmed, then concatenated
// with fixed gaps, so every word's true onset is known exactly.
// Usage (in container): node align.mjs <model: small|medium> <outDir>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const model = process.argv[2] ?? "small";
const out = process.argv[3] ?? "/spike/out";
mkdirSync(join(out, "words"), { recursive: true });

const TEXT = [
  "Lãi kép là khi tiền lãi của bạn tiếp tục sinh ra tiền lãi.",
  "Nếu gửi mười triệu đồng với lãi suất tám phần trăm mỗi năm,",
  "sau mười năm bạn sẽ có khoảng hai mươi mốt triệu sáu trăm nghìn đồng.",
  "Ẩn số quan trọng nhất chính là thời gian, và bạn nên bắt đầu sớm.",
].join(" ").normalize("NFC");

const GAP_S = 0.07;
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const dur = (f) => Number(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const norm = (w) => w.normalize("NFC").toLowerCase().replace(/[.,!?;:"“”()…-]/g, "").trim();

// 1) Build reference audio with exact word onsets.
const words = TEXT.split(/\s+/);
const ref = [];
let t = 0.3; // leading silence
const listFile = join(out, "concat.txt");
const lines = [`file '${join(out, "lead.wav")}'`];
sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "0.3", join(out, "lead.wav")]);
sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", String(GAP_S), join(out, "gap.wav")]);
words.forEach((w, i) => {
  const raw = join(out, "words", `${i}-raw.wav`);
  const wav = join(out, "words", `${i}.wav`);
  sh("espeak-ng", ["-v", "vi", "-s", "165", "-w", raw, w]);
  // Trim leading/trailing silence so the measured onset is the true speech onset.
  sh("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
    "-ar", "16000", "-ac", "1", wav]);
  const d = dur(wav);
  ref.push({ word: w, norm: norm(w), start: +t.toFixed(3), end: +(t + d).toFixed(3) });
  t += d + GAP_S;
  lines.push(`file '${wav}'`, `file '${join(out, "gap.wav")}'`);
});
writeFileSync(listFile, lines.join("\n"));
const refWav = join(out, "reference.wav");
sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-ar", "16000", "-ac", "1", refWav]);
writeFileSync(join(out, "reference.json"), JSON.stringify(ref, null, 2));

// 2) whisper.cpp with DTW token timestamps.
const base = join(out, `whisper-${model}`);
const t0 = Date.now();
sh("/opt/whisper.cpp/build/bin/whisper-cli", [
  "-m", `/opt/whisper.cpp/models/ggml-${model}.bin`, "-l", "vi", "-f", refWav,
  "-ojf", "-of", base, "--dtw", model, "-t", "8", "-np",
]);
const elapsedS = (Date.now() - t0) / 1000;
const wj = JSON.parse(readFileSync(`${base}.json`, "utf8"));

// 3) Tokens -> words (a token starting with a space begins a new word). Prefer DTW time.
const hyp = [];
for (const seg of wj.transcription ?? []) {
  for (const tok of seg.tokens ?? []) {
    if (/^\[_|^<\|/.test(tok.text)) continue; // special tokens
    const startS = typeof tok.t_dtw === "number" && tok.t_dtw >= 0 ? tok.t_dtw / 100 : tok.offsets.from / 1000;
    if (tok.text.startsWith(" ") || hyp.length === 0) hyp.push({ text: tok.text.trim(), start: startS });
    else hyp[hyp.length - 1].text += tok.text;
  }
}
// whisper may emit byte-level pieces for diacritics; rebuild text via UTF-8 decode is already done by whisper.cpp JSON.
hyp.forEach((h) => (h.norm = norm(h.text)));
const hypW = hyp.filter((h) => h.norm);

// 4) Needleman–Wunsch alignment on normalized words.
const n = ref.length, m = hypW.length;
const S = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
for (let i = 0; i <= n; i++) S[i][0] = -i;
for (let j = 0; j <= m; j++) S[0][j] = -j;
for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
  S[i][j] = Math.max(S[i - 1][j - 1] + (ref[i - 1].norm === hypW[j - 1].norm ? 2 : -1), S[i - 1][j] - 1, S[i][j - 1] - 1);
const pairs = [];
for (let i = n, j = m; i > 0 && j > 0;) {
  if (S[i][j] === S[i - 1][j - 1] + (ref[i - 1].norm === hypW[j - 1].norm ? 2 : -1)) {
    if (ref[i - 1].norm === hypW[j - 1].norm) pairs.push({ ref: ref[i - 1], hyp: hypW[j - 1] });
    i--; j--;
  } else if (S[i][j] === S[i - 1][j] - 1) i--; else j--;
}
const errs = pairs.map((p) => Math.abs(p.hyp.start - p.ref.start) * 1000).sort((a, b) => a - b);
const q = (p) => (errs.length ? +errs[Math.min(errs.length - 1, Math.floor(p * errs.length))].toFixed(1) : null);
const result = {
  model, audioSeconds: +dur(refWav).toFixed(2), whisperSeconds: elapsedS,
  refWords: n, hypWords: m, matchedWords: pairs.length, matchRate: +(pairs.length / n).toFixed(3),
  onsetErrorMs: { median: q(0.5), p90: q(0.9), max: q(1) },
  transcript: hypW.map((h) => h.text).join(" "),
};
writeFileSync(join(out, `result-${model}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
