// M0 spike T010: verify BullMQ features we rely on work against Valkey 8.
// Checks: priorities (preview > single > batch), FlowProducer parent/child, rate limiter,
// job dedup by jobId (idempotency), retries with backoff, group-like per-workspace concurrency via limiter.
import { Queue, Worker, FlowProducer, QueueEvents, type Job } from "bullmq";

const connection = { host: "127.0.0.1", port: Number(process.env.VALKEY_PORT ?? 6390) };
const results: Record<string, boolean | string> = {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function priorities() {
  const q = new Queue("prio", { connection });
  await q.obliterate({ force: true });
  // Lower number = higher priority in BullMQ.
  await q.add("batch", { k: "batch" }, { priority: 10 });
  await q.add("single", { k: "single" }, { priority: 5 });
  await q.add("preview", { k: "preview" }, { priority: 1 });
  const order: string[] = [];
  const w = new Worker("prio", async (j: Job) => { order.push(j.data.k); }, { connection, concurrency: 1 });
  while (order.length < 3) await sleep(50);
  await w.close(); await q.close();
  results.priorities = order.join(">") === "preview>single>batch" ? true : `got ${order.join(">")}`;
}

async function flows() {
  const fp = new FlowProducer({ connection });
  const done: string[] = [];
  const w = new Worker("steps", async (j: Job) => {
    done.push(j.name);
    if (j.name === "mux") {
      const kids = await j.getChildrenValues();
      return Object.keys(kids).length;
    }
    return j.name;
  }, { connection, concurrency: 4 });
  const ev = new QueueEvents("steps", { connection });
  await ev.waitUntilReady();
  const flow = await fp.add({
    name: "mux", queueName: "steps",
    children: [1, 2, 3].map((i) => ({ name: `render_scene_${i}`, queueName: "steps", data: {} })),
  });
  const v = await flow.job.waitUntilFinished(ev, 15000);
  results.flowParentAfterChildren = v === 3 && done.at(-1) === "mux" ? true : `value=${v} order=${done.join(",")}`;
  await w.close(); await ev.close(); await fp.close();
}

async function rateLimit() {
  const q = new Queue("rl", { connection });
  await q.obliterate({ force: true });
  for (let i = 0; i < 6; i++) await q.add("x", { i });
  const t0 = Date.now();
  let n = 0;
  const w = new Worker("rl", async () => { n++; }, { connection, limiter: { max: 2, duration: 1000 } });
  while (n < 6) await sleep(50);
  const elapsed = Date.now() - t0;
  await w.close(); await q.close();
  results.rateLimiter = elapsed >= 1900 ? true : `elapsed ${elapsed}ms (expected >=2000)`;
}

async function idempotency() {
  const q = new Queue("idem", { connection });
  await q.obliterate({ force: true });
  await q.add("compile", {}, { jobId: "v1:compile:abc" });
  await q.add("compile", {}, { jobId: "v1:compile:abc" });
  const c = await q.getJobCounts("waiting");
  await q.close();
  results.idempotentJobId = c.waiting === 1 ? true : `waiting=${c.waiting}`;
}

async function retries() {
  const q = new Queue("retry", { connection });
  await q.obliterate({ force: true });
  let attempts = 0;
  const ev = new QueueEvents("retry", { connection });
  await ev.waitUntilReady();
  const w = new Worker("retry", async () => { attempts++; if (attempts < 3) throw new Error("transient"); return "ok"; }, { connection });
  const job = await q.add("tts", {}, { attempts: 3, backoff: { type: "exponential", delay: 100 } });
  const v = await job.waitUntilFinished(ev, 15000);
  results.retriesWithBackoff = v === "ok" && attempts === 3 ? true : `v=${v} attempts=${attempts}`;
  await w.close(); await ev.close(); await q.close();
}

for (const f of [priorities, flows, rateLimit, idempotency, retries]) {
  try { await f(); } catch (e) { results[f.name] = `ERROR ${(e as Error).message}`; }
}
console.log(JSON.stringify(results, null, 2));
process.exit(Object.values(results).every((v) => v === true) ? 0 : 1);
