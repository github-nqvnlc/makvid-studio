// T064: TtsProvider + Aligner contract. Mock FPT and mock aligner servers by default (no network);
// live run against FPT + worker-align with MAKVID_LIVE_TTS=1.
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  concatPcm,
  FptTtsProvider,
  mapAlignedWords,
  MfaAligner,
  narrate,
  parseVoiceId,
  readWav,
  trimSilence,
  writeWav,
  type Pcm,
} from "../src";

const tone = (ms: number, rate = 22050, silenceMs = 100): Pcm => {
  const n = Math.round((rate * (ms + 2 * silenceMs)) / 1000);
  const s = new Float32Array(n);
  const a = Math.round((rate * silenceMs) / 1000);
  for (let i = a; i < n - a; i++) s[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / rate);
  return { sampleRate: rate, samples: s };
};

let server: Server;
let base = "";
const ttsCalls: Array<{ model: string; voice: string; input: string; auth: string }> = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.url === "/v1/audio/speech") {
        const b = JSON.parse(raw);
        ttsCalls.push({
          model: b.model,
          voice: b.voice,
          input: b.input,
          auth: String(req.headers.authorization),
        });
        res.writeHead(200, { "content-type": "audio/wav" });
        res.end(writeWav(tone(b.input.split(" ").length * 250)));
      } else if (req.url === "/align") {
        const b = JSON.parse(raw) as { utterances: Array<{ id: string; text: string }> };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            utterances: b.utterances.map((u) => ({
              id: u.id,
              // pretend each word lasts 250 ms after a 15 ms pad; lower-case, no punctuation (like MFA)
              words: u.text.split(" ").map((w, i) => ({
                text: w.toLowerCase().replace(/[^\p{L}]/gu, ""),
                startMs: 15 + i * 250,
                endMs: 15 + (i + 1) * 250,
              })),
            })),
          }),
        );
      } else res.writeHead(404).end();
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", () => ok()));
  const a = server.address();
  base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

describe("WAV utilities", () => {
  it("round-trips PCM and trims silence", () => {
    const p = tone(1000);
    const back = readWav(writeWav(p));
    expect(back.sampleRate).toBe(22050);
    expect(back.samples.length).toBe(p.samples.length);
    const t = trimSilence(back);
    const ms = (t.pcm.samples.length / t.pcm.sampleRate) * 1000;
    expect(ms).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(1060);
  });
  it("concatenates with exact onsets", () => {
    const c = concatPcm(
      [
        { pcm: tone(500, 22050, 0), gapAfterMs: 300 },
        { pcm: tone(200, 22050, 0), gapAfterMs: 0 },
      ],
      250,
    );
    expect(c.onsetsMs.map(Math.round)).toEqual([250, 1050]);
  });
});

describe("FptTtsProvider", () => {
  it("parses voice ids (default VITs) and lists voices", async () => {
    expect(parseVoiceId("fpt:banmai")).toEqual({ model: "vits", voice: "banmai" });
    expect(parseVoiceId("pro:std_quanganh")).toEqual({ model: "pro", voice: "std_quanganh" });
    const voices = await new FptTtsProvider("k", `${base}/v1`).listVoices();
    expect(voices.map((v) => v.id)).toEqual(
      expect.arrayContaining(["vits:banmai", "pro:std_banmai", "ultra:std_kimngan"]),
    );
  });

  it("synthesizes WAV with NFC text, model mapping and cost", async () => {
    ttsCalls.length = 0;
    const r = await new FptTtsProvider("test-key", `${base}/v1`).synthesize({
      text: "Xin chào Ẩn Ỹ".normalize("NFD"),
      voiceId: "pro:std_banmai",
    });
    expect(r.mime).toBe("audio/wav");
    expect(readWav(r.audio).sampleRate).toBe(22050);
    expect(ttsCalls[0]).toMatchObject({
      model: "FPT.TTS-pro",
      voice: "std_banmai",
      input: "Xin chào Ẩn Ỹ",
      auth: "Bearer test-key",
    });
    expect(r.chars).toBe(13);
    expect(r.costUsd).toBe(0.000215); // 13 chars * $16.5 / 1M, rounded to 6 decimals
    expect(r.words).toBeUndefined();
  });

  it("rejects voices the model does not offer", async () => {
    await expect(
      new FptTtsProvider("k", `${base}/v1`).synthesize({ text: "a", voiceId: "pro:banmai" }),
    ).rejects.toThrow(/not available/);
  });
});

describe("alignment mapping", () => {
  it("maps MFA words back onto script words, keeping punctuation and interpolating misses", () => {
    const script = ["Gửi", "10", "triệu,", "nhé!"];
    const aligned = [
      { text: "gửi", startMs: 0, endMs: 200 },
      { text: "triệu", startMs: 500, endMs: 800 },
      { text: "nhé", startMs: 800, endMs: 1000 },
    ];
    const m = mapAlignedWords(script, aligned, 1000);
    expect(m.map((w) => w.text)).toEqual(script);
    expect(m[1]).toMatchObject({ startMs: 200, endMs: 500 }); // "10" missing -> interpolated between neighbours
    expect(m[2]).toMatchObject({ startMs: 500 });
  });
});

describe("narrate (mock TTS + mock aligner)", () => {
  it("places words at sentence onset + aligned offset, in order", async () => {
    const n = await narrate(
      [
        { scriptId: "s1", text: "Một hai ba." },
        { scriptId: "s2", text: "Bốn năm." },
      ],
      {
        tts: new FptTtsProvider("k", `${base}/v1`),
        aligner: new MfaAligner(base),
        voiceId: "vits:banmai",
        leadMs: 250,
      },
    );
    expect(n.words.map((w) => w.text)).toEqual(["Một", "hai", "ba.", "Bốn", "năm."]);
    expect(n.parts[0]!.startMs).toBe(250);
    expect(n.words[0]!.startMs).toBe(250 + 15);
    expect(n.parts[1]!.startMs).toBeGreaterThan(n.parts[0]!.endMs + 300); // sentence pause
    for (let i = 1; i < n.words.length; i++)
      expect(n.words[i]!.startMs).toBeGreaterThan(n.words[i - 1]!.startMs);
    expect(n.durationMs).toBeGreaterThan(n.parts[1]!.endMs);
  });
});

describe.runIf(process.env.MAKVID_LIVE_TTS === "1")("live FPT + worker-align", () => {
  it("narrates two sentences with MFA word timings", async () => {
    const n = await narrate(
      [
        { scriptId: "s1", text: "Lãi kép là khi tiền lãi tiếp tục sinh ra tiền lãi." },
        { scriptId: "s2", text: "Hãy bắt đầu tiết kiệm ngay hôm nay." },
      ],
      {
        tts: new FptTtsProvider(process.env.FPT_AI_API_KEY!),
        aligner: new MfaAligner(),
        voiceId: "vits:banmai",
      },
    );
    expect(n.words).toHaveLength(20);
    expect(n.words[0]!.startMs).toBeGreaterThanOrEqual(240);
    expect(n.words.at(-1)!.endMs).toBeLessThanOrEqual(n.durationMs);
    expect(n.costUsd).toBeGreaterThan(0);
  }, 300_000);
});
