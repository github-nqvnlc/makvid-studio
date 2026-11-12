// Shared mocks for pipeline integration tests (no network): LLM, TTS, aligner, renderer.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChatAdapter } from "@makvid/ai";
import type { Renderer } from "@makvid/renderer";
import { MfaAligner, writeWav, type SynthesisResult, type TtsProvider, type Voice } from "@makvid/tts";

export const SENTENCES = [
  "Tiền có thể tự đẻ ra tiền không?",
  "Đó chính là sức mạnh của lãi kép khi bạn kiên nhẫn đủ lâu với khoản tiết kiệm nhỏ mỗi tháng.",
  "Bạn cần ba thứ là vốn ban đầu, lãi suất ổn định và thật nhiều thời gian để tiền tự lớn lên.",
  "So với lãi đơn, lãi kép tăng nhanh hơn rõ rệt sau mỗi năm và càng về sau càng mạnh mẽ.",
  "Albert Einstein từng gọi lãi kép là kỳ quan thứ tám của thế giới theo nhiều giai thoại.",
  "Hãy bắt đầu tiết kiệm ngay hôm nay nhé.",
];

export const calls = { llm: 0, tts: 0, renders: 0 };
export const mockLlm: ChatAdapter = {
  provider: "fpt",
  async chat(_model, messages) {
    calls.llm++;
    const sys = messages[0]!.content;
    let text: string;
    if (sys.includes("LỜI ĐỌC")) text = JSON.stringify({ title: "Sức mạnh lãi kép", sentences: SENTENCES });
    else if (sys.includes("đạo diễn hình ảnh"))
      text = JSON.stringify({ suggestions: [{ styleId: "minimal", reason: "Rõ ràng, chuyên nghiệp" }] });
    else if (sys.includes("CHỮ TRÊN MÀN HÌNH"))
      text = JSON.stringify({
        scenes: [
          { templateId: "hook", sentences: [1], slots: { headline: "Tiền tự đẻ ra tiền?" } },
          { templateId: "title", sentences: [2], slots: { title: "Sức mạnh của lãi kép" } },
          {
            templateId: "list",
            sentences: [3],
            slots: { title: "Ba thứ cần có", items: ["Vốn ban đầu", "Lãi suất ổn định", "Thời gian"] },
          },
          {
            templateId: "compare",
            sentences: [4],
            slots: {
              title: "Đơn và kép",
              leftLabel: "Lãi đơn",
              leftItems: ["Tăng đều"],
              rightLabel: "Lãi kép",
              rightItems: ["Tăng nhanh dần"],
            },
          },
          {
            templateId: "quote",
            sentences: [5],
            slots: { quote: "Kỳ quan thứ tám của thế giới", author: "Giai thoại" },
          },
          {
            templateId: "cta",
            sentences: [6],
            slots: { headline: "Tiết kiệm từ hôm nay", action: "Bắt đầu ngay", handle: "@bịa" },
          },
        ],
      });
    else text = JSON.stringify({ patches: [{ slot: "title", value: "Ngắn" }] });
    return { text, inputTokens: 1000, outputTokens: 200 };
  },
};

export const mockTts: TtsProvider = {
  id: "fpt",
  async listVoices(): Promise<Voice[]> {
    return [];
  },
  async synthesize({ text }): Promise<SynthesisResult> {
    calls.tts++;
    const ms = text.split(/\s+/).length * 250;
    const rate = 22050;
    const n = Math.round((rate * (ms + 200)) / 1000);
    const s = new Float32Array(n);
    for (let i = Math.round(rate * 0.1); i < n - Math.round(rate * 0.1); i++)
      s[i] = 0.3 * Math.sin((2 * Math.PI * 200 * i) / rate);
    return {
      audio: writeWav({ sampleRate: rate, samples: s }),
      mime: "audio/wav",
      chars: [...text].length,
      costUsd: ([...text].length * 16.5) / 1e6,
    };
  },
};

export class MockAligner extends MfaAligner {
  override async alignMany(utts: Array<{ id: string; wav: Buffer; text: string }>) {
    return new Map(
      utts.map((u) => [
        u.id,
        u.text.split(/\s+/).map((w, i) => ({
          text: w.toLowerCase().replace(/[^\p{L}]/gu, ""),
          startMs: 15 + i * 250,
          endMs: 15 + (i + 1) * 250,
        })),
      ]),
    );
  }
}

export const stubRenderer: Renderer = {
  id: "fallback",
  version: "stub",
  async renderScene(i) {
    calls.renders++;
    const frames =
      Number(/data-duration="([\d.]+)"/.exec(readFileSync(join(i.sceneDir, "index.html"), "utf8"))![1]) * 30;
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=${i.width}x${i.height}:r=30`,
      "-frames:v",
      String(Math.round(frames)),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      i.outPath,
    ]);
    return { outPath: i.outPath, frames: Math.round(frames), durationMs: (frames / 30) * 1000 };
  },
  async captureFrames(i) {
    return i.atMs.map((atMs) => ({
      atMs,
      png: Buffer.alloc(0),
      dom: { width: i.width, height: i.height, elements: [], blockedRequests: [], fontsLoaded: [] },
    }));
  },
};
