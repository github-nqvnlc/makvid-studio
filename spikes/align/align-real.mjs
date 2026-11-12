// T009 re-run, step 2 (container, --network none): real TTS phrases -> concatenated audio with known
// phrase onsets -> whisper.cpp DTW -> match words to the known script (Needleman–Wunsch) -> interpolate
// unmatched words -> score phrase-onset error. Usage: node align-real.mjs <model> <phraseDir>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const model = process.argv[2] ?? "small";
const dir = process.argv[3];
const GAP_S = 0.25;
const sh = (c, a) => execFileSync(c, a, { encoding: "utf8", maxBuffer: 256 << 20 });
const dur = (f) => Number(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());
const norm = (w) => w.normalize("NFC").toLowerCase().replace(/[.,!?;:"“”()…-]/g, "").trim();
const phrases = JSON.parse(readFileSync(join(dir, "phrases.json"), "utf8"));

// 1) Trim each phrase and concatenate with fixed gaps; record exact phrase onsets.
sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", String(GAP_S), join(dir, "gap.wav")]);
const lines = [`file '${join(dir, "gap.wav")}'`];
const ref = []; // words with phraseIndex; phrase onsets known
const onsets = [];
let t = GAP_S;
phrases.forEach((p, i) => {
  const wav = join(dir, `${i}.wav`);
  sh("ffmpeg", ["-y", "-loglevel", "error", "-i", join(dir, `${i}.mp3`), "-af",
    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
    "-ar", "16000", "-ac", "1", wav]);
  onsets.push(+t.toFixed(3));
  for (const w of p.split(/\s+/)) ref.push({ word: w, norm: norm(w), phrase: i });
  t += dur(wav) + GAP_S;
  lines.push(`file '${wav}'`, `file '${join(dir, "gap.wav")}'`);
});
writeFileSync(join(dir, "concat.txt"), lines.join("\n"));
const audio = join(dir, "reference.wav");
sh("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "concat.txt"), "-ar", "16000", "-ac", "1", audio]);

// 2) whisper.cpp with DTW timestamps, prompted with the known script to reduce hallucination.
const base = join(dir, `whisper-${model}`);
const t0 = Date.now();
sh("/opt/whisper.cpp/build/bin/whisper-cli", ["-m", `/opt/whisper.cpp/models/ggml-${model}.bin`, "-l", "vi", "-f", audio,
  "-ojf", "-of", base, "--dtw", model, "-t", "8", "-np", "--prompt", phrases.join(" ")]);
const whisperS = (Date.now() - t0) / 1000;
const wj = JSON.parse(readFileSync(`${base}.json`, "utf8"));
const hyp = [];
for (const seg of wj.transcription ?? []) for (const tok of seg.tokens ?? []) {
  if (/^\[_|^<\|/.test(tok.text)) continue;
  const s = typeof tok.t_dtw === "number" && tok.t_dtw >= 0 ? tok.t_dtw / 100 : tok.offsets.from / 1000;
  if (tok.text.startsWith(" ") || !hyp.length) hyp.push({ text: tok.text.trim(), start: s });
  else hyp[hyp.length - 1].text += tok.text;
}
const H = hyp.map((h) => ({ ...h, norm: norm(h.text) })).filter((h) => h.norm);

// 3) Needleman–Wunsch; matched words get whisper time, others are interpolated.
const n = ref.length, m = H.length, sc = (i, j) => (ref[i].norm === H[j].norm ? 2 : -1);
const S = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? -j : j === 0 ? -i : 0)));
for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) S[i][j] = Math.max(S[i - 1][j - 1] + sc(i - 1, j - 1), S[i - 1][j] - 1, S[i][j - 1] - 1);
for (let i = n, j = m; i > 0 && j > 0;) {
  if (S[i][j] === S[i - 1][j - 1] + sc(i - 1, j - 1)) { if (sc(i - 1, j - 1) > 0) ref[i - 1].t = H[j - 1].start; i--; j--; }
  else if (S[i][j] === S[i - 1][j] - 1) i--; else j--;
}
const matched = ref.filter((r) => r.t !== undefined).length;
const end = dur(audio);
for (let i = 0; i < n; i++) if (ref[i].t === undefined) {
  let a = i - 1; while (a >= 0 && ref[a].t === undefined) a--;
  let b = i + 1; while (b < n && ref[b].t === undefined) b++;
  const ta = a >= 0 ? ref[a].t : 0, tb = b < n ? ref[b].t : end;
  ref[i].t = ta + ((tb - ta) * (i - a)) / (b - a); ref[i].interp = true;
}
// 4) Phrase-onset error = |time of first word of phrase - true onset|.
const errs = onsets.map((o, p) => { const w = ref.find((r) => r.phrase === p); return { phrase: p, trueS: o, estS: +w.t.toFixed(3), errMs: Math.round(Math.abs(w.t - o) * 1000), interp: !!w.interp }; });
const e = errs.map((x) => x.errMs).sort((a, b) => a - b), q = (p) => e[Math.min(e.length - 1, Math.floor(p * e.length))];
const result = { model, dir, audioSeconds: +end.toFixed(2), whisperSeconds: whisperS, refWords: n, matchedWords: matched,
  matchRate: +(matched / n).toFixed(3), phraseOnsetErrorMs: { median: q(0.5), p90: q(0.9), max: q(1) },
  within150ms: errs.filter((x) => x.errMs <= 150).length + "/" + errs.length, errs, transcript: H.map((h) => h.text).join(" ") };
writeFileSync(join(dir, `result-${model}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, errs: undefined }));
