// US4 sources through the whole pipeline (mock LLM/TTS/aligner/renderer, real compile + QA + mux):
//  - written script: narration is exactly the user's text, no LLM script call;
//  - table: every chart shows the file's numbers exactly;
//  - audio/video: whisper segments + MFA timings (mocked speech services) and "use the original voice":
//    no TTS call, and a dropped scene also drops its audio.
// Run: MAKVID_PIPELINE_TESTS=1 pnpm --filter @makvid/tests test integration/pipeline-sources
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLlm, DEFAULT_STEPS } from "@makvid/ai";
import { ingestMedia, ingestScript, ingestTable, type SpeechServices } from "@makvid/media";
import { loadState, produceVideo, type PipelineContext, type ProduceInput } from "@makvid/pipeline";
import { calls, MockAligner, mockLlm, mockTts, stubRenderer } from "@makvid/pipeline/testing";
import { probe } from "@makvid/renderer";

const root = resolve(__dirname, "../..");
const fx = (f: string) => readFileSync(join(root, "fixtures/sources", f), "utf8");

function ctxFor(workDir: string): PipelineContext {
  return {
    llm: createLlm({ adapters: { fpt: mockLlm }, steps: DEFAULT_STEPS }),
    tts: mockTts,
    aligner: new MockAligner("http://unused"),
    renderer: stubRenderer,
    stylesRoot: join(root, "packages", "styles"),
    workDir,
    voiceId: "vits:banmai",
    onUsage: () => undefined,
    onProgress: () => undefined,
  };
}

describe.runIf(process.env.MAKVID_PIPELINE_TESTS === "1")("pipeline with US4 sources", () => {
  it("written script: narrated word for word, no script LLM call", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "mkv-src-script-"));
    const source = ingestScript(fx("script-vi.txt"));
    const input: ProduceInput = {
      prompt: "kịch bản",
      aspects: ["9:16"],
      durationSec: 30,
      source,
      styleId: "minimal",
    };
    const steps: string[] = [];
    const r = await produceVideo({ ...ctxFor(workDir), onUsage: (u) => steps.push(u.step) }, input);
    expect(r.status).toBe("ready");
    expect(r.spec.script.map((s) => s.text)).toEqual(source.sentences);
    // Title = the first sentence, shortened to at most 60 characters.
    expect(r.title.startsWith("Bạn có biết mỗi ngày")).toBe(true);
    expect([...r.title].length).toBeLessThanOrEqual(60);
    expect(steps).not.toContain("script"); // no LLM rewriting of the narration
    expect(steps).toContain("storyboard");
  }, 300_000);

  it("table: every stat scene shows exactly the file's numbers", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "mkv-src-table-"));
    const source = ingestTable(fx("gia-vang.csv"), { title: "Giá vàng 2026" });
    const r = await produceVideo(ctxFor(workDir), {
      prompt: "Giá vàng 2026",
      aspects: ["9:16"],
      durationSec: 30,
      source,
      styleId: "infographic",
    });
    expect(r.status).toBe("ready");
    const stats = r.spec.scenes.filter((s) => s.templateId === "stat");
    for (const s of stats) {
      expect(s.slots.series).toEqual({ series: source.series });
      expect(source.series!.map((p) => p.value)).toContain(s.slots.value);
    }
  }, 300_000);

  it("audio/video: transcript timed per word, original voice kept, dropped scene drops its audio", async () => {
    const workDir = mkdtempSync(join(tmpdir(), "mkv-src-media-"));
    // 12 s test recording (tone) standing in for speech; whisper + MFA are mocked below.
    const file = join(workDir, "talk.mp4");
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=12",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:d=12",
      "-shortest",
      "-c:a",
      "aac",
      "-c:v",
      "libx264",
      file,
    ]);
    const lines = [
      "Xin chào các bạn.",
      "Hôm nay mình nói về tiết kiệm.",
      "Mỗi tháng hãy để dành một phần lương.",
      "Đừng quên đặt mục tiêu rõ ràng.",
      "Chúc các bạn thành công.",
    ];
    const speech: SpeechServices = {
      async transcribe() {
        return lines.map((text, i) => ({ startMs: i * 2400, endMs: i * 2400 + 2000, text }));
      },
      async alignMany(utts) {
        return new Map(
          utts.map((u) => {
            const ws = u.text.split(/\s+/);
            return [
              u.id,
              ws.map((w, k) => ({
                text: w.toLowerCase().replace(/[^\p{L}]/gu, ""),
                startMs: 100 + k * 300,
                endMs: 350 + k * 300,
              })),
            ];
          }),
        );
      },
    };
    const source = await ingestMedia(file, { speech, workDir });
    expect(source.sentences).toEqual(lines);
    expect(source.transcript![0]).toEqual({ text: "Xin", startMs: 100, endMs: 350 });
    expect(source.transcript!.find((w) => w.text === "tiết")!.startMs).toBe(2400 + 100 + 5 * 300);

    const ttsBefore = calls.tts;
    let drop = "";
    const r = await produceVideo(
      ctxFor(workDir),
      {
        prompt: "bài nói",
        aspects: ["9:16"],
        durationSec: 30,
        source,
        useSourceAudio: true,
        styleId: "minimal",
        mode: "review",
      },
      {
        reviewer: {
          script: async () => ({}),
          storyboard: async (state) => {
            drop = state.spec!.scenes[2]!.id; // the scene with sentence 3
            return { dropSceneIds: [drop] };
          },
        },
      },
    );
    expect(r.status).toBe("ready");
    expect(calls.tts).toBe(ttsBefore); // original voice, no TTS
    expect(r.spec.script.map((s) => s.text)).toEqual(lines.filter((_, i) => i !== 2));
    const words = r.spec.audio.narration!.words.map((w) => w.text).join(" ");
    expect(words).not.toContain("lương");
    // 4 kept sentences of ~1.3 s each + pauses: far shorter than the 12 s recording.
    const p = await probe(r.outputs[0]!.video);
    expect(p.durationSec).toBeLessThan(10);
    expect(loadState(workDir)!.spec!.scenes.map((s) => s.id)).not.toContain(drop);
  }, 300_000);
});
