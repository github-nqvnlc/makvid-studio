// QA text fixes from an offline render worker: the request travels through the qa-fix queue, worker-ai's
// LLM answers, and the render side gets the patches and the provider usage back.
// Run: MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/tests exec vitest run integration/qa-fix
import { Queue } from "bullmq";
import { afterAll, describe, expect, it } from "vitest";
import type { LlmProvider } from "@makvid/ai";
import { QA_FIX_QUEUE, remoteFixer, startQaFixWorker } from "@makvid/pipeline";
import { connectionFromUrl } from "@makvid/queue";

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("remote QA text fixes", () => {
  const connection = connectionFromUrl();
  const prefix = `mkvqafix${process.pid}`;
  const seen: string[] = [];
  // A fake LLM standing in for the provider worker-ai would call.
  const llm = {
    async complete(req: { step: string; messages: Array<{ content: string }> }) {
      seen.push(req.step);
      return {
        output: { patches: [{ slot: "headline", value: "Ngắn hơn" }] },
        usage: [{ provider: "fpt", model: "fast", inputTokens: 120, outputTokens: 20, costUsd: 0.00004 }],
        text: "",
      };
    },
  } as unknown as LlmProvider;
  const worker = startQaFixWorker(llm, connection, { prefix });

  afterAll(async () => {
    await worker.close();
    const q = new Queue(QA_FIX_QUEUE, { connection, prefix });
    await q.obliterate({ force: true });
    await q.close();
  });

  it("returns the LLM patches and usage to the caller", async () => {
    const fix = remoteFixer(connection, { prefix, timeoutMs: 30_000 });
    const r = await fix({ headline: "Một tiêu đề rất dài bị tràn ra ngoài khung hình" }, [
      "cannot fit headline",
    ]);
    expect(r.patches).toEqual([{ slot: "headline", value: "Ngắn hơn" }]);
    expect(r.usage[0]).toMatchObject({ provider: "fpt", inputTokens: 120, outputTokens: 20 });
    expect(seen).toEqual(["qa_fix"]);
  });
});
