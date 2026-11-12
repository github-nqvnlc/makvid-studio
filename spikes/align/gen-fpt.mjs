// T009 re-run, step 1 (host, needs FPT_AI_API_KEY): synthesize short phrases with FPT AI Marketplace
// so phrase onsets in the concatenated audio are known exactly. Usage:
//   node --env-file=../../.env gen-fpt.mjs <voice> <outDir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const voice = process.argv[2] ?? "banmai";
const out = process.argv[3] ?? "output/fpt";
mkdirSync(out, { recursive: true });
const PHRASES = [
  "Lãi kép là khi tiền lãi của bạn",
  "tiếp tục sinh ra tiền lãi.",
  "Nếu gửi mười triệu đồng",
  "với lãi suất tám phần trăm mỗi năm,",
  "sau mười năm bạn sẽ có",
  "khoảng hai mươi mốt triệu sáu trăm nghìn đồng.",
  "Ẩn số quan trọng nhất",
  "chính là thời gian,",
  "và bạn nên bắt đầu sớm.",
  "Albert Einstein từng gọi lãi kép",
  "là kỳ quan thứ tám của thế giới.",
  "Hãy để thời gian làm việc cho bạn.",
].map((p) => p.normalize("NFC"));
for (const [i, input] of PHRASES.entries()) {
  const r = await fetch("https://mkp-api.fptcloud.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.FPT_AI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "FPT.AI-VITs", voice, input, response_format: "mp3" }),
  });
  if (!r.ok) throw new Error(`phrase ${i}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  writeFileSync(join(out, `${i}.mp3`), Buffer.from(await r.arrayBuffer()));
}
writeFileSync(join(out, "phrases.json"), JSON.stringify(PHRASES, null, 2));
console.log(`ok ${PHRASES.length} phrases -> ${out}`);
