// T143: /api/v1 responses validated against contracts/public-api.openapi.yaml, end to end on a running mock
// stack (US7 independent test: create a video with an API key, receive a signed webhook, verify it, download
// via an expiring link). Run:
//   MAKVID_WEBHOOK_TEST_PORT=47811 MAKVID_PAYMENTS=mock node scripts/dev-stack.mjs --mock
//   MAKVID_E2E_BASE_URL=http://localhost:3000 MAKVID_WEBHOOK_TEST_PORT=47811 pnpm --filter @makvid/web exec vitest run test/api-v1.contract.test.ts
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { hash } from "@node-rs/argon2";
import { parse } from "yaml";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiKeys,
  connect,
  memberships,
  subscriptions,
  templates,
  users,
  withWorkspace,
  workspaces,
  type Db,
} from "@makvid/db";
import { encryptSecret, newWebhookSecret, verifyWebhook } from "@makvid/pipeline";
import { webhookEndpoints } from "@makvid/db";
import { extractVariables, templatize, type VideoSpec } from "@makvid/spec";

const root = resolve(__dirname, "../../..");
const BASE = process.env.MAKVID_E2E_BASE_URL;
const HOOK_PORT = Number(process.env.MAKVID_WEBHOOK_TEST_PORT ?? 47811);
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  /* env from the shell */
}

const doc = parse(
  readFileSync(join(root, "specs/001-ai-video-saas/contracts/public-api.openapi.yaml"), "utf8"),
) as { components: { schemas: Record<string, object> } };
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
for (const [name, s] of Object.entries(doc.components.schemas))
  ajv.addSchema(s, `#/components/schemas/${name}`);
/** Validate `data` against a contract schema (refs resolved within components). */
function conforms(name: string, data: unknown) {
  const schema = JSON.parse(
    JSON.stringify(doc.components.schemas[name]).replace(/"#\/components\/schemas\//g, '"#/$defs/'),
  ) as object;
  const v = ajv.compile({ ...schema, $defs: doc.components.schemas });
  const ok = v(data);
  if (!ok) throw new Error(`${name}: ${ajv.errorsText(v.errors)} in ${JSON.stringify(data)}`);
  return true;
}

describe.runIf(!!BASE)("public API v1 contract (running mock stack)", { timeout: 600_000 }, () => {
  let db: Db;
  let close: () => Promise<void>;
  let key = "";
  let freeKey = "";
  let templateId = "";
  let hookSecret = "";
  let hookServer: Server;
  const hooks: Array<{ sig: string; body: string }> = [];
  const ws = randomUUIDv4();
  const freeWs = randomUUIDv4();

  function randomUUIDv4() {
    return crypto.randomUUID();
  }
  async function makeKey(workspaceId: string) {
    const prefix = `mk_live_${randomBytes(6).toString("hex")}`;
    const k = `${prefix}_${randomBytes(24).toString("base64url")}`;
    await withWorkspace(db, workspaceId, async (tx) =>
      tx.insert(apiKeys).values({
        workspaceId,
        name: "contract",
        prefix,
        hash: await hash(k, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
        scopes: ["videos:read", "videos:write"],
      }),
    );
    return k;
  }
  const call = (path: string, init: RequestInit = {}, k = key) =>
    fetch(`${BASE}/api/v1${path}`, {
      ...init,
      headers: { ...(k ? { authorization: `Bearer ${k}` } : {}), ...(init.headers ?? {}) },
    });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    call(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
    });
  async function until<T>(f: () => Promise<T>, ok: (x: T) => boolean, ms = 540_000): Promise<T> {
    const t0 = Date.now();
    for (;;) {
      const x = await f();
      if (ok(x)) return x;
      if (Date.now() - t0 > ms) throw new Error(`timeout: ${JSON.stringify(x)}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  beforeAll(async () => {
    ({ db, close } = connect(process.env.DATABASE_URL, 4));
    const [u] = await db
      .insert(users)
      .values({ email: `api-${ws.slice(0, 8)}@example.test` })
      .returning();
    for (const [id, paid] of [
      [ws, true],
      [freeWs, false],
    ] as const)
      await withWorkspace(db, id, async (tx) => {
        await tx
          .insert(workspaces)
          .values({ id, name: "API", slug: `api-${id.slice(0, 8)}`, createdBy: u!.id });
        await tx.insert(memberships).values({ workspaceId: id, userId: u!.id, role: "owner" });
        if (paid)
          await tx.insert(subscriptions).values({
            workspaceId: id,
            planId: "pro",
            provider: "manual",
            providerRef: `contract-${id}`,
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
          });
      });
    key = await makeKey(ws);
    freeKey = await makeKey(freeWs);
    const fixture = JSON.parse(
      readFileSync(join(root, "fixtures/specs/sample-vi.json"), "utf8"),
    ) as VideoSpec;
    const spec = templatize(fixture, [{ find: "lãi kép", name: "chu_de" }]);
    const [t] = await withWorkspace(db, ws, (tx) =>
      tx
        .insert(templates)
        .values({
          workspaceId: ws,
          versionId: crypto.randomUUID(),
          spec,
          name: "API template",
          variables: extractVariables(spec),
          settings: { aspects: ["9:16"], voiceId: "vits:banmai" },
        })
        .returning(),
    );
    templateId = t!.id;
    hookSecret = newWebhookSecret();
    await withWorkspace(db, ws, (tx) =>
      tx.insert(webhookEndpoints).values({
        workspaceId: ws,
        url: `http://127.0.0.1:${HOOK_PORT}/hook`,
        secretEnc: encryptSecret(hookSecret),
        events: ["video.completed", "video.failed", "batch.completed"],
      }),
    );
    hookServer = createServer((req, res) => {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        hooks.push({ sig: String(req.headers["x-makvid-signature"] ?? ""), body });
        res.end("ok");
      });
    });
    await new Promise<void>((r) => hookServer.listen(HOOK_PORT, "127.0.0.1", r));
  }, 60_000);

  afterAll(async () => {
    hookServer?.close();
    await close?.();
  });

  it("styles and voices", async () => {
    const s = await call("/styles");
    expect(s.status).toBe(200);
    const styles = await s.json();
    expect(conforms("StyleList", styles)).toBe(true);
    expect((styles as { styles: unknown[] }).styles.length).toBe(13);
    const v = await call("/voices");
    expect(conforms("VoiceList", await v.json())).toBe(true);
  });

  it("errors follow the Error schema: no key, bad key, not found, plan without API", async () => {
    for (const [res, status] of [
      [await call("/styles", {}, ""), 401],
      [await call("/styles", {}, `mk_live_000000000000_${"x".repeat(32)}`), 401],
      [await call(`/videos/${crypto.randomUUID()}`), 404],
      [await call("/styles", {}, freeKey), 402],
    ] as const) {
      expect(res.status).toBe(status);
      expect(conforms("Error", await res.json())).toBe(true);
    }
  });

  let videoId = "";
  it("creates a video (Idempotency-Key replays; a different body with the same key is refused)", async () => {
    const idem = crypto.randomUUID();
    const body = { source: { prompt: "Lãi kép là gì" }, aspects: ["9:16"], targetDurationSec: 30 };
    const r1 = await post("/videos", body, { "idempotency-key": idem });
    expect(r1.status).toBe(202);
    const j1 = (await r1.json()) as { id: string };
    expect(conforms("Job", j1)).toBe(true);
    const r2 = await post("/videos", body, { "idempotency-key": idem });
    expect(r2.status).toBe(202);
    expect(r2.headers.get("idempotent-replayed")).toBe("true");
    expect(((await r2.json()) as { id: string }).id).toBe(j1.id);
    const r3 = await post("/videos", { ...body, targetDurationSec: 31 }, { "idempotency-key": idem });
    expect(r3.status).toBe(422);
    expect(conforms("Error", await r3.json())).toBe(true);
    const bad = await post("/videos", { source: { prompt: "" } });
    expect(bad.status).toBe(422);
    videoId = j1.id;
  });

  it("video status, signed webhook, expiring download link", async () => {
    const v = await until(
      async () => (await (await call(`/videos/${videoId}`)).json()) as { status: string },
      (x) => ["ready", "needs_attention", "failed"].includes(x.status),
    );
    expect(conforms("Video", v)).toBe(true);
    expect(v.status).toBe("ready");
    const d = await call(`/videos/${videoId}/download?aspect=9:16`);
    const links = (await d.json()) as { mp4: string; expiresAt: string };
    expect(conforms("Download", links)).toBe(true);
    expect(new Date(links.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const mp4 = await fetch(links.mp4);
    expect(mp4.status).toBe(200);
    expect(mp4.headers.get("content-type")).toBe("video/mp4");
    const hook = await until(
      async () => hooks.find((h) => h.body.includes(videoId)),
      (h) => !!h,
      60_000,
    );
    expect(verifyWebhook(hookSecret, hook!.body, hook!.sig)).toBe(true);
    const payload = JSON.parse(hook!.body) as unknown;
    expect(conforms("WebhookPayload", payload)).toBe(true);
    expect(payload).toMatchObject({ event: "video.completed", videoId, status: "ready" });
  });

  it("template video and batch (multipart), progress, ZIP, retry-failed", async () => {
    const t = await post(`/templates/${templateId}/videos`, { variables: { chu_de: "quỹ hưu trí" } });
    expect(t.status).toBe(202);
    expect(conforms("Job", await t.json())).toBe(true);
    const form = new FormData();
    form.set("templateId", templateId);
    form.set("file", new Blob(["chu_de\nquỹ một\nquỹ hai\n"], { type: "text/csv" }), "rows.csv");
    const b = await call("/batches", { method: "POST", body: form });
    expect(b.status).toBe(202);
    const batch = (await b.json()) as { id: string };
    expect(conforms("Batch", batch)).toBe(true);
    const done = await until(
      async () => (await (await call(`/batches/${batch.id}`)).json()) as { status: string; zipUrl?: string },
      (x) => x.status === "completed" && !!x.zipUrl,
    );
    expect(conforms("Batch", done)).toBe(true);
    const r = await call(`/batches/${batch.id}/retry-failed`, { method: "POST" });
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ retried: 0 });
    const hook = await until(
      async () => hooks.find((h) => h.body.includes(batch.id)),
      (h) => !!h,
      60_000,
    );
    expect(JSON.parse(hook!.body)).toMatchObject({
      event: "batch.completed",
      batchId: batch.id,
      status: "completed",
    });
  });

  it("rate limit: 429 with Retry-After once a key goes over its per-minute budget", async () => {
    const k = await makeKey(ws);
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let i = 0; i < 70; i++) {
      const r = await call("/voices", {}, k);
      statuses.push(r.status);
      if (r.status === 429) {
        retryAfter = r.headers.get("retry-after");
        expect(conforms("Error", await r.json())).toBe(true);
        break;
      }
    }
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    expect(statuses.at(-1)).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });
});
