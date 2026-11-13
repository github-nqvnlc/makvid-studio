// T144: webhook signature (t=<unix>,v1=<hex HMAC-SHA256 of "t.body">), retries, and SSRF protection.
// The delivery part uses Postgres from the compose stack: MAKVID_INFRA_TESTS=1.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  connect,
  memberships,
  migrate,
  users,
  webhookDeliveries,
  webhookEndpoints,
  withService,
  withWorkspace,
  workspaces,
  type Db,
} from "@makvid/db";
import {
  decryptSecret,
  deliverWebhook,
  encryptSecret,
  newWebhookSecret,
  signWebhook,
  verifyWebhook,
  WebhookDeliveryError,
} from "@makvid/pipeline";

const KEY = "test-server-key-0123456789abcdef";

describe("signature", () => {
  it("round-trips and rejects tampering, other secrets and stale timestamps", () => {
    const secret = newWebhookSecret();
    const body = JSON.stringify({ event: "video.completed", videoId: "v1", status: "ready" });
    const now = 1_763_000_000;
    const h = signWebhook(secret, body, now);
    expect(h).toMatch(/^t=1763000000,v1=[0-9a-f]{64}$/);
    expect(verifyWebhook(secret, body, h, now)).toBe(true);
    expect(verifyWebhook(secret, body.replace("ready", "failed"), h, now)).toBe(false);
    expect(verifyWebhook(newWebhookSecret(), body, h, now)).toBe(false);
    expect(verifyWebhook(secret, body, h, now + 301)).toBe(false);
  });

  it("encrypts endpoint secrets at rest (AES-256-GCM)", () => {
    const s = newWebhookSecret();
    const enc = encryptSecret(s, KEY);
    expect(enc).not.toContain(s.slice(6, 20));
    expect(decryptSecret(enc, KEY)).toBe(s);
    expect(() => decryptSecret(enc, "another-key")).toThrow();
    expect(encryptSecret(s, KEY)).not.toBe(enc); // random IV
  });
});

const admin = process.env.DATABASE_ADMIN_URL ?? "postgres://makvid:makvid-dev@localhost:5432/postgres";
const dbName = `makvid_hooks_${process.pid}`;
const url = admin.replace(/\/[^/]*$/, `/${dbName}`);

describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("delivery", () => {
  let db: Db;
  let close: () => Promise<void>;
  let srv: Server;
  let port = 0;
  const received: Array<{ headers: Record<string, unknown>; body: string }> = [];
  let answers: number[] = [];
  const ws = "77777777-7777-4777-8777-777777777777";
  let secret = "";
  const allowLoopback = { isBlocked: () => false, allowedPorts: [] as number[] };

  beforeAll(async () => {
    process.env.MAKVID_SECRET_KEY = KEY;
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.unsafe(`CREATE DATABASE ${dbName}`);
    await a.end();
    await migrate(url);
    ({ db, close } = connect(url, 4));
    const [u] = await db.insert(users).values({ email: "hooks@example.test" }).returning();
    await withWorkspace(db, ws, async (tx) => {
      await tx.insert(workspaces).values({ id: ws, name: "H", slug: "h", createdBy: u!.id });
      await tx.insert(memberships).values({ workspaceId: ws, userId: u!.id, role: "owner" });
    });
    srv = createServer((req, res) => {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        received.push({ headers: req.headers, body });
        res.statusCode = answers.shift() ?? 200;
        res.end("ok");
      });
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    port = (srv.address() as AddressInfo).port;
    allowLoopback.allowedPorts = [port];
  }, 60_000);

  afterAll(async () => {
    srv?.close();
    await close?.();
    const a = postgres(admin, { max: 1, onnotice: () => undefined });
    await a.unsafe(`DROP DATABASE IF EXISTS ${dbName}`);
    await a.end();
  });

  async function delivery(target: string) {
    secret = newWebhookSecret();
    return withWorkspace(db, ws, async (tx) => {
      const [ep] = await tx
        .insert(webhookEndpoints)
        .values({
          workspaceId: ws,
          url: target,
          secretEnc: encryptSecret(secret),
          events: ["video.completed"],
        })
        .returning();
      const [d] = await tx
        .insert(webhookDeliveries)
        .values({
          workspaceId: ws,
          endpointId: ep!.id,
          eventId: `e-${Math.random()}`,
          event: "video.completed",
          payload: { event: "video.completed", videoId: "v1", status: "ready", message: "Video is ready." },
        })
        .returning();
      return d!.id;
    });
  }
  const row = async (id: string) =>
    (
      await withService(db, (tx) => tx.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)))
    )[0]!;

  it("retries after a 500 and delivers a body the receiver can verify", async () => {
    const id = await delivery(`http://127.0.0.1:${port}/hook`);
    answers = [500, 200];
    await expect(deliverWebhook(db, id, 1, false, allowLoopback)).rejects.toBeInstanceOf(
      WebhookDeliveryError,
    );
    expect((await row(id)).status).toBe("pending");
    expect(await deliverWebhook(db, id, 2, false, allowLoopback)).toBe("delivered");
    const r = await row(id);
    expect([r.status, r.attempts, r.lastHttpStatus]).toEqual(["delivered", 2, 200]);
    const last = received.at(-1)!;
    expect(last.headers["x-makvid-event"]).toBe("video.completed");
    expect(verifyWebhook(secret, last.body, String(last.headers["x-makvid-signature"]))).toBe(true);
    // A delivered event is never sent again.
    expect(await deliverWebhook(db, id, 3, false, allowLoopback)).toBe("skipped");
  });

  it("refuses private and internal addresses (SSRF) and marks the delivery failed on the last attempt", async () => {
    for (const target of [
      `http://127.0.0.1:${port}/hook`, // loopback (default policy)
      "http://169.254.169.254/latest/meta-data", // cloud metadata
      "http://10.0.0.5/hook",
      "http://localhost/hook",
    ]) {
      const id = await delivery(target);
      const before = received.length;
      await expect(deliverWebhook(db, id, 8, true)).rejects.toMatchObject({
        message: expect.stringMatching(/blocked_address|port/),
      });
      expect((await row(id)).status).toBe("failed");
      expect(received.length).toBe(before); // nothing reached our server
    }
  });

  it("never follows redirects for a POST", async () => {
    const id = await delivery(`http://127.0.0.1:${port}/hook`);
    answers = [302];
    await expect(deliverWebhook(db, id, 1, false, allowLoopback)).rejects.toMatchObject({ httpStatus: 302 });
  });
});
