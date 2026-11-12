// T062: the full automatic pipeline with mock LLM / TTS / aligner / renderer (no network, fast).
// Asserts: every step runs, usage is recorded per step, the output MP4 exists with audio, and a re-run
// with the same input skips the cached AI/TTS steps and the render cache.
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLlm, DEFAULT_STEPS } from "@makvid/ai";
import { produceVideo, type PipelineContext, type UsageEntry } from "@makvid/pipeline";
import { probe } from "@makvid/renderer";
import { calls, mockLlm, mockTts, MockAligner, SENTENCES, stubRenderer } from "./mocks";

const root = resolve(__dirname, "../..");
describe.runIf(process.env.MAKVID_RENDER_TESTS === "1" || process.env.MAKVID_PIPELINE_TESTS === "1")(
  "pipeline (T062)",
  () => {
    it("produces a video end to end and re-runs idempotently", async () => {
      const workDir = mkdtempSync(join(tmpdir(), "mkv-pipe-"));
      const usage: UsageEntry[] = [];
      const ctx: PipelineContext = {
        llm: createLlm({ adapters: { fpt: mockLlm }, steps: DEFAULT_STEPS }),
        tts: mockTts,
        aligner: new MockAligner("http://unused"),
        renderer: stubRenderer,
        stylesRoot: join(root, "packages", "styles"),
        workDir,
        voiceId: "vits:banmai",
        onUsage: (u) => usage.push(u),
        onProgress: () => undefined,
      };
      const input = { prompt: "Lãi kép là gì", aspects: ["9:16" as const], durationSec: 30 };
      // QA uses real Chrome capture; swap to the stub for speed by patching the renderer module is not needed:
      // captureFrames from @makvid/renderer is used directly, so this run exercises real QA.
      const r1 = await produceVideo(ctx, input);
      expect(r1.status).toBe("ready");
      expect(r1.spec.scenes.find((s) => s.templateId === "cta")!.slots.handle).toBeUndefined();
      expect(new Set(usage.map((u) => u.step))).toEqual(
        new Set(["script", "style_suggest", "storyboard", "tts", "render_scene"]),
      );
      const p = await probe(r1.outputs[0]!.video);
      expect(p.acodec).toBe("aac");
      expect(
        Math.abs(p.durationSec * 1000 - r1.spec.scenes.reduce((a, s) => a + s.timing!.durationMs, 0)),
      ).toBeLessThan(80);
      expect(existsSync(r1.outputs[0]!.srt)).toBe(true);
      const words = r1.spec.audio.narration!.words;
      expect(words.length).toBe(SENTENCES.join(" ").split(" ").length);
      writeFileSync(join(workDir, "r1.json"), JSON.stringify({ cost: r1.costUsd }));

      const before = { ...calls };
      const r2 = await produceVideo(ctx, input);
      expect(calls.llm).toBe(before.llm); // script/style/storyboard cached
      expect(calls.tts).toBe(before.tts); // narration cached
      expect(calls.renders).toBe(before.renders); // every scene from the render cache
      expect(r2.outputs[0]!.cacheHits).toBe(r1.spec.scenes.length);
    }, 600_000);
  },
);
