// M0 benchmark T007: synthesize the same Vietnamese sample with several TTS providers.
// Runs only providers whose credentials are present in the environment; never prints keys.
//
//   AZURE_SPEECH_KEY + AZURE_SPEECH_REGION   Azure Speech (REST, lists vi-VN voices)
//   GOOGLE_TTS_API_KEY                       Google Cloud Text-to-Speech (REST v1)
//   ELEVENLABS_API_KEY [+ ELEVENLABS_VOICE_IDS=id1,id2]  ElevenLabs /with-timestamps
//   OPENAI_API_KEY                           OpenAI /v1/audio/speech
//   FPT_AI_API_KEY                           FPT.AI TTS v5 (async URL, legacy api.fpt.ai key)
//   FPT_AI_API_KEY (sk-...)                  FPT AI Marketplace, OpenAI-compatible /v1/audio/speech
//   FPT_MKP_MODELS=FPT.AI-VITs,...           models to try (default FPT.AI-VITs)
//
// Usage: npx tsx bench/tts/run.ts
// Endpoints verified against current docs on 2026-11-12 (see bench/tts/report.md).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = join(dir, "out");
mkdirSync(OUT, { recursive: true });
const TEXT = readFileSync(join(dir, "sample-vi.txt"), "utf8").trim().normalize("NFC");

interface Word { text: string; startMs: number; endMs: number }
interface Result {
  provider: string; voice: string; file: string; chars: number; latencyMs: number;
  wordTimestamps: "native" | "none"; words?: Word[]; error?: string;
}

const results: Result[] = [];
const env = (k: string) => process.env[k]?.trim() || undefined;

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const v = await fn();
  return [v, Math.round(performance.now() - t0)];
}
async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res;
}
function save(provider: string, voice: string, ext: string, buf: Buffer): string {
  const file = join(OUT, `${provider}-${voice.replace(/[^\w.-]+/g, "_")}.${ext}`);
  writeFileSync(file, buf);
  return file;
}

async function azure() {
  const key = env("AZURE_SPEECH_KEY"), region = env("AZURE_SPEECH_REGION");
  if (!key || !region) return;
  const base = `https://${region}.tts.speech.microsoft.com/cognitiveservices`;
  const voices = (await (await ok(await fetch(`${base}/voices/list`, { headers: { "Ocp-Apim-Subscription-Key": key } }), "azure voices")).json()) as Array<{ ShortName: string; Locale: string }>;
  for (const v of voices.filter((x) => x.Locale === "vi-VN")) {
    const ssml = `<speak version="1.0" xml:lang="vi-VN"><voice name="${v.ShortName}">${TEXT}</voice></speak>`;
    const [buf, ms] = await timed(async () => Buffer.from(await (await ok(await fetch(`${base}/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3", "User-Agent": "tts-bench" },
      body: ssml,
    }), "azure synth")).arrayBuffer()));
    // Word boundaries are only available through the Speech SDK events, not this REST call.
    results.push({ provider: "azure", voice: v.ShortName, file: save("azure", v.ShortName, "mp3", buf), chars: TEXT.length, latencyMs: ms, wordTimestamps: "none" });
  }
}

async function google() {
  const key = env("GOOGLE_TTS_API_KEY");
  if (!key) return;
  const list = (await (await ok(await fetch(`https://texttospeech.googleapis.com/v1/voices?languageCode=vi-VN&key=${key}`), "google voices")).json()) as { voices: Array<{ name: string }> };
  for (const v of list.voices ?? []) {
    const [buf, ms] = await timed(async () => {
      const r = (await (await ok(await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: { text: TEXT }, voice: { languageCode: "vi-VN", name: v.name }, audioConfig: { audioEncoding: "MP3" } }),
      }), "google synth")).json()) as { audioContent: string };
      return Buffer.from(r.audioContent, "base64");
    });
    results.push({ provider: "google", voice: v.name, file: save("google", v.name, "mp3", buf), chars: TEXT.length, latencyMs: ms, wordTimestamps: "none" });
  }
}

async function elevenlabs() {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) return;
  const ids = (env("ELEVENLABS_VOICE_IDS") ?? "").split(",").filter(Boolean);
  if (!ids.length) { console.warn("ELEVENLABS_VOICE_IDS not set; skipping ElevenLabs"); return; }
  for (const id of ids) {
    const [r, ms] = await timed(async () => (await (await ok(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}/with-timestamps`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: TEXT, model_id: env("ELEVENLABS_MODEL") ?? "eleven_multilingual_v2" }),
    }), "elevenlabs")).json()) as { audio_base64: string; alignment?: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] } });
    // Character-level alignment -> words.
    const words: Word[] = [];
    const a = r.alignment;
    if (a) {
      let cur: Word | null = null;
      a.characters.forEach((ch, i) => {
        if (/\s/.test(ch)) { if (cur) words.push(cur); cur = null; return; }
        const s = Math.round(a.character_start_times_seconds[i] * 1000), e = Math.round(a.character_end_times_seconds[i] * 1000);
        cur = cur ? { ...cur, text: cur.text + ch, endMs: e } : { text: ch, startMs: s, endMs: e };
      });
      if (cur) words.push(cur);
    }
    results.push({ provider: "elevenlabs", voice: id, file: save("elevenlabs", id, "mp3", Buffer.from(r.audio_base64, "base64")), chars: TEXT.length, latencyMs: ms, wordTimestamps: a ? "native" : "none", words });
  }
}

async function openai() {
  const key = env("OPENAI_API_KEY");
  if (!key) return;
  for (const [model, voice] of [["gpt-4o-mini-tts", "alloy"], ["gpt-4o-mini-tts", "nova"], ["tts-1-hd", "onyx"]] as const) {
    const [buf, ms] = await timed(async () => Buffer.from(await (await ok(await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: TEXT, response_format: "mp3" }),
    }), "openai")).arrayBuffer()));
    results.push({ provider: "openai", voice: `${model}-${voice}`, file: save("openai", `${model}-${voice}`, "mp3", buf), chars: TEXT.length, latencyMs: ms, wordTimestamps: "none" });
  }
}

async function fpt() {
  const key = env("FPT_AI_API_KEY");
  if (!key || key.startsWith("sk-")) return;
  // Voices per docs: banmai, thuminh (F north), leminh (M north), myan (F central), giahuy (M central), lannhi, linhsan (F south).
  for (const voice of ["banmai", "leminh", "lannhi", "giahuy", "myan"]) {
    const [buf, ms] = await timed(async () => {
      const r = (await (await ok(await fetch("https://api.fpt.ai/hmi/tts/v5", {
        method: "POST", headers: { api_key: key, voice, "Cache-Control": "no-cache" }, body: TEXT,
      }), "fpt")).json()) as { async?: string; error?: number; message?: string };
      if (!r.async) throw new Error(`fpt: ${r.message ?? "no async url"}`);
      for (let i = 0; i < 60; i++) {
        const a = await fetch(r.async);
        if (a.ok) return Buffer.from(await a.arrayBuffer());
        await new Promise((res) => setTimeout(res, 2000));
      }
      throw new Error("fpt: audio not ready after 120 s");
    });
    results.push({ provider: "fpt", voice, file: save("fpt", voice, "mp3", buf), chars: TEXT.length, latencyMs: ms, wordTimestamps: "none" });
  }
}

async function fptMarketplace() {
  // FPT AI Marketplace keys look like "sk-..."; OpenAI-compatible endpoint (probed 2026-11-12:
  // /v1/models lists FPT.AI-VITs, FPT.TTS-pro, FPT.TTS-ultra; unknown voice returns the voice list).
  const key = env("FPT_AI_API_KEY");
  if (!key?.startsWith("sk-")) return;
  const models = (env("FPT_MKP_MODELS") ?? "FPT.AI-VITs").split(",").filter(Boolean);
  const voices = (env("FPT_MKP_VOICES") ?? "banmai,leminh,thuminh,giahuy,ngoclam,minhquan,kimngan,huyphong,hatieumai").split(",");
  for (const model of models) for (const voice of voices) {
    try {
      const [buf, ms] = await timed(async () => Buffer.from(await (await ok(await fetch("https://mkp-api.fptcloud.com/v1/audio/speech", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, voice, input: TEXT, response_format: "mp3" }),
      }), "fpt-mkp")).arrayBuffer()));
      results.push({ provider: "fpt-mkp:" + model, voice, file: save("fpt-mkp", model + "-" + voice, "mp3", buf), chars: TEXT.length, latencyMs: ms, wordTimestamps: "none" });
    } catch (e) {
      results.push({ provider: "fpt-mkp:" + model, voice, file: "-", chars: TEXT.length, latencyMs: 0, wordTimestamps: "none", error: (e as Error).message });
    }
  }
}

for (const p of [azure, google, elevenlabs, openai, fpt, fptMarketplace]) {
  try { await p(); } catch (e) { results.push({ provider: p.name, voice: "-", file: "-", chars: TEXT.length, latencyMs: 0, wordTimestamps: "none", error: (e as Error).message }); }
}
writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.table(results.map(({ words, ...r }) => ({ ...r, words: words?.length ?? 0 })));
if (!results.length) console.log("No provider credentials found. Set the env vars listed at the top of this file.");
