import { Writable } from "node:stream";
import { afterAll, describe, expect, it } from "vitest";
import { connectionFromUrl, createLogger, inputHash, jobId, PipelineQueues, PRIORITY } from "../src";

describe("job identity", () => {
  it("inputHash is key-order independent and content sensitive", () => {
    expect(inputHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(inputHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(inputHash({ a: 1 })).not.toBe(inputHash({ a: 2 }));
  });
  it("jobId is deterministic and BullMQ-safe", () => {
    expect(jobId("v_1", "render", "abc")).toBe("v_1.render.abc");
    expect(() => jobId("v:1", "render", "abc")).toThrow();
  });
  it("priority classes order preview > single > batch", () => {
    expect(PRIORITY.preview).toBeLessThan(PRIORITY.single);
    expect(PRIORITY.single).toBeLessThan(PRIORITY.batch);
  });
});

describe("logger", () => {
  it("redacts secrets", async () => {
    const lines: string[] = [];
    const dest = new Writable({ write: (c, _e, cb) => (lines.push(String(c)), cb()) });
    const log = createLogger("t", { destination: dest });
    log.info({ provider: { apiKey: "sk-secret-value" }, headers: { authorization: "Bearer x" } }, "call");
    await new Promise((r) => setTimeout(r, 10));
    const out = lines.join("");
    expect(out).not.toContain("sk-secret-value");
    expect(out).not.toContain("Bearer x");
    expect(out).toContain("[redacted]");
  });
});

// Integration against Valkey from docker/compose.dev.yml: MAKVID_INFRA_TESTS=1
describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("PipelineQueues on Valkey", () => {
  const queues = new PipelineQueues(connectionFromUrl(), `mkvtest${process.pid}`);
  afterAll(async () => {
    for (const n of ["ai", "render"] as const) await queues.queue(n).obliterate({ force: true });
    await queues.close();
  });

  it("enqueue is idempotent per (versionId, step, inputHash)", async () => {
    const p = {
      workspaceId: "w",
      projectId: "p",
      versionId: "v1",
      step: "render" as const,
      input: { scene: "hook", hash: "x" },
    };
    const a = await queues.enqueue(p, "single");
    const b = await queues.enqueue({ ...p, input: { hash: "x", scene: "hook" } }, "single");
    const c = await queues.enqueue({ ...p, input: { scene: "cta", hash: "x" } }, "single");
    expect(a.created).toBe(true);
    expect(b).toEqual({ id: a.id, created: false });
    expect(c.created).toBe(true);
    expect(await queues.queue("render").count()).toBe(2);
  });

  it("routes steps to their worker queue with the priority class", async () => {
    const r = await queues.enqueue(
      { workspaceId: "w", projectId: "p", versionId: "v2", step: "script", input: {} },
      "preview",
    );
    const job = await queues.queue("ai").getJob(r.id);
    expect(job?.opts.priority).toBe(PRIORITY.preview);
  });
});
