// Mock providers (no network): LLM, TTS, aligner, renderer. Used by integration tests and, with
// MAKVID_MOCK_PROVIDERS=1, by the workers + web app for end-to-end tests without paid calls.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estimateSeconds, type ChatAdapter } from "@makvid/ai";
import type { Renderer } from "@makvid/renderer";
import { MfaAligner, writeWav, type SynthesisResult, type TtsProvider, type Voice } from "@makvid/tts";

export const SENTENCES = [
  "Tiền có thể tự đẻ ra tiền không?",
  "Đó chính là sức mạnh của lãi kép khi bạn kiên nhẫn đủ lâu với khoản tiết kiệm nhỏ mỗi tháng của mình.",
  "Bạn cần ba thứ là vốn ban đầu, lãi suất ổn định và thật nhiều thời gian để tiền tự lớn lên từng năm.",
  "So với lãi đơn, lãi kép tăng nhanh hơn rõ rệt sau mỗi năm và càng về sau càng mạnh mẽ hơn nhiều lần.",
  "Albert Einstein từng gọi lãi kép là kỳ quan thứ tám của thế giới theo nhiều giai thoại được kể lại.",
  "Hãy bắt đầu tiết kiệm ngay hôm nay, dù chỉ là một khoản nhỏ, vì thời gian chính là người bạn tốt nhất của bạn.",
];

/** Extra narration used to reach longer target durations (inserted inside the list/compare/quote scenes). */
const EXTRA = [
  "Mỗi kỳ lãi được cộng vào vốn, nên kỳ sau bạn nhận lãi trên một số tiền lớn hơn kỳ trước một chút.",
  "Càng gửi sớm thì đồ thị tài sản càng cong lên mạnh, vì thời gian nhân lên mọi khoản lãi nhỏ bé ban đầu.",
  "Lãi đơn chỉ tính trên số vốn ban đầu, còn lãi kép tính trên cả phần lãi bạn đã nhận được trước đó.",
  "Rút tiền giữa chừng sẽ làm gãy chuỗi lãi kép, nên hãy giữ kỷ luật và kiên nhẫn với kế hoạch của mình.",
  "Nhiều người giàu lên không nhờ thu nhập cao, mà nhờ để tiền làm việc đủ lâu trong những kênh an toàn.",
  "Một khoản nhỏ đều đặn mỗi tháng có thể trở thành một số tiền đáng kể sau mười hay hai mươi năm nữa.",
];
/** Split k extra sentences over the list / compare / quote scenes (each scene keeps ≤ 3 sentences). */
const groups = (k: number): [number, number, number] => {
  const a = Math.ceil(k / 3);
  const b = Math.ceil((k - a) / 2);
  return [a, b, k - a - b];
};
/** The mock script: the 6 base sentences plus as many extras as the requested duration needs. */
export function mockScript(durationSec: number): string[] {
  let k = 0;
  const build = (n: number) => {
    const [a, b, c] = groups(n);
    const ex = EXTRA.slice(0, n);
    return [
      ...SENTENCES.slice(0, 3),
      ...ex.slice(0, a),
      SENTENCES[3]!,
      ...ex.slice(a, a + b),
      SENTENCES[4]!,
      ...ex.slice(a + b, a + b + c),
      SENTENCES[5]!,
    ];
  };
  while (k < EXTRA.length && estimateSeconds(build(k)) < durationSec * 0.95) k++;
  return build(k);
}

export const calls = { llm: 0, tts: 0, renders: 0 };
export const mockLlm: ChatAdapter = {
  provider: "fpt",
  async chat(_model, messages) {
    calls.llm++;
    const sys = messages[0]!.content;
    let text: string;
    if (sys.includes("LỜI ĐỌC")) {
      const d = Number(/dài khoảng (\d+) giây/.exec(sys)?.[1] ?? 30);
      text = JSON.stringify({ title: "Sức mạnh lãi kép", sentences: mockScript(d) });
    } else if (sys.includes("đạo diễn hình ảnh"))
      text = JSON.stringify({
        suggestions: [
          { styleId: "minimal", reason: "Rõ ràng, chuyên nghiệp" },
          { styleId: "kinetic", reason: "Chữ chuyển động, cuốn hút" },
        ],
      });
    else if (sys.includes("CHỮ TRÊN MÀN HÌNH")) {
      const n = (messages[messages.length - 1]!.content.match(/^\d+\. /gm) ?? []).length;
      const [a, b, c] = groups(Math.max(0, n - SENTENCES.length));
      const run = (from: number, len: number) => Array.from({ length: len }, (_, i) => from + i);
      text = JSON.stringify({
        scenes: [
          { templateId: "hook", sentences: [1], slots: { headline: "Tiền tự đẻ ra tiền?" } },
          { templateId: "title", sentences: [2], slots: { title: "Sức mạnh của lãi kép" } },
          {
            templateId: "list",
            sentences: run(3, 1 + a),
            slots: { title: "Ba thứ cần có", items: ["Vốn ban đầu", "Lãi suất ổn định", "Thời gian"] },
          },
          {
            templateId: "compare",
            sentences: run(4 + a, 1 + b),
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
            sentences: run(5 + a + b, 1 + c),
            slots: { quote: "Kỳ quan thứ tám của thế giới", author: "Giai thoại" },
          },
          {
            templateId: "cta",
            sentences: [n || 6],
            slots: { headline: "Tiết kiệm từ hôm nay", action: "Bắt đầu ngay", handle: "@bịa" },
          },
        ],
      });
    } else if (sys.includes("trợ lý chỉnh sửa video"))
      text = mockChatAnswer(sys, messages[messages.length - 1]!.content);
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

/**
 * Chat mock: "Đổi tiêu đề thành: X" edits the title of the title scene; "Đổi chữ cảnh N thành: X" edits the
 * first text of scene N; "Đổi phong cách sang <id>" changes the style; anything else asks one question.
 */
function mockChatAnswer(system: string, user: string): string {
  const re = /Cảnh (\d+) \(sceneId "([^"]+)", template "([^"]+)"\)\n {2}chữ trên màn hình: (.*)/g;
  const scenes = [...system.matchAll(re)].map((m) => ({
    n: Number(m[1]),
    id: m[2]!,
    templateId: m[3]!,
    slots: JSON.parse(m[4]!) as Record<string, unknown>,
  }));
  const firstText = (sc: (typeof scenes)[number]) =>
    Object.entries(sc.slots).find(([, v]) => typeof v === "string")?.[0] ?? "title";
  let m = /tiêu đề thành:\s*(.+)$/i.exec(user);
  const titleScene = scenes.find((s) => s.templateId === "title");
  if (m && titleScene)
    return JSON.stringify({
      kind: "edit",
      reply: "Mình đã đổi tiêu đề.",
      edits: [{ op: "set_slot", sceneId: titleScene.id, slot: "title", value: m[1]!.trim() }],
    });
  m = /cảnh (\d+) thành:\s*(.+)$/i.exec(user);
  if (m) {
    const sc = scenes.find((s) => s.n === Number(m![1]));
    if (!sc)
      return JSON.stringify({
        kind: "info",
        reply: `Video chỉ có ${scenes.length} cảnh. Bạn muốn sửa cảnh nào?`,
        edits: [],
      });
    return JSON.stringify({
      kind: "edit",
      reply: `Mình đã sửa cảnh ${sc.n}.`,
      edits: [{ op: "set_slot", sceneId: sc.id, slot: firstText(sc), value: m[2]!.trim() }],
    });
  }
  m = /phong cách sang\s+([a-z-]+)/i.exec(user);
  if (m)
    return JSON.stringify({
      kind: "edit",
      reply: "Mình đã đổi phong cách.",
      edits: [{ op: "set_style", styleId: m[1] }],
    });
  return JSON.stringify({ kind: "clarify", reply: "Bạn muốn thay đổi điều gì ở cảnh nào?", edits: [] });
}
