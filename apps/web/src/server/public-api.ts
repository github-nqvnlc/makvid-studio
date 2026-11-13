// Public API v1 plumbing (US7, T146): workspace API keys (argon2id), per-key rate limit (Valkey, fixed
// window, 429 + Retry-After), Idempotency-Key replay, and the error shape of contracts/public-api.openapi.yaml
// ({ code, message, hint }). Messages are user-facing English and never name internal technology.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { and, eq, isNull } from "drizzle-orm";
import Redis from "ioredis";
import { planOf, QuotaError, type QuotaDenial } from "@makvid/billing";
import { apiKeys, idempotencyKeys, withService, withWorkspace } from "@makvid/db";
import { ProjectError } from "@makvid/pipeline";
import { server } from "./deps";

export const KEY_PREFIX = "mk_live_";
export const RATE_LIMIT_PER_MIN = Number(process.env.MAKVID_API_RATE_PER_MIN ?? 60);
export type Scope = "videos:read" | "videos:write";

// ---------------------------------------------------------------- errors

const MESSAGES: Record<string, [number, string, string?]> = {
  unauthorized: [401, "Missing or invalid API key.", "Send Authorization: Bearer mk_live_..."],
  forbidden: [403, "This API key is not allowed to do this.", "Check the key's scopes."],
  api_disabled: [402, "The API is not included in your plan.", "Upgrade your plan to use the API."],
  quota_exceeded: [402, "Your plan's allowance is used up.", "Upgrade or buy extra minutes."],
  invalid: [422, "The request is not valid."],
  not_found: [404, "Not found."],
  conflict: [409, "The request conflicts with the current state."],
  busy: [409, "The video is still being produced."],
  idempotency_mismatch: [422, "This Idempotency-Key was used with a different request.", "Use a new key."],
  idempotency_in_progress: [409, "A request with this Idempotency-Key is still running."],
  rate_limited: [429, "Too many requests.", "Wait for Retry-After seconds."],
  generic: [500, "Something went wrong. Please try again later."],
};

export function apiError(
  code: string,
  extra: { hint?: string; headers?: Record<string, string>; reason?: string } = {},
) {
  const [status, message, hint] = MESSAGES[code] ?? MESSAGES.generic!;
  return Response.json(
    {
      code,
      message,
      ...((extra.hint ?? hint) ? { hint: extra.hint ?? hint } : {}),
      ...(extra.reason ? { reason: extra.reason } : {}),
    },
    { status, ...(extra.headers ? { headers: extra.headers } : {}) },
  );
}

// ---------------------------------------------------------------- keys

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const; // OWASP argon2id baseline

/** Create a key; the full secret is returned once and never stored. */
export async function createApiKey(
  workspaceId: string,
  userId: string | null,
  name: string,
  scopes: Scope[],
) {
  const prefix = `${KEY_PREFIX}${randomBytes(6).toString("hex")}`;
  const secret = randomBytes(24).toString("base64url");
  const key = `${prefix}_${secret}`;
  const [row] = await withWorkspace(server().db, workspaceId, async (tx) =>
    tx
      .insert(apiKeys)
      .values({
        workspaceId,
        name: name.slice(0, 80),
        prefix,
        hash: await argonHash(key, ARGON),
        scopes,
        createdBy: userId,
      })
      .returning({ id: apiKeys.id, prefix: apiKeys.prefix, createdAt: apiKeys.createdAt }),
  );
  return { ...row!, key };
}

export async function listApiKeys(workspaceId: string) {
  return withWorkspace(server().db, workspaceId, (tx) =>
    tx
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(isNull(apiKeys.revokedAt)),
  );
}

export async function revokeApiKey(workspaceId: string, id: string) {
  await withWorkspace(server().db, workspaceId, (tx) =>
    tx.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id)),
  );
}

export interface ApiCaller {
  keyId: string;
  workspaceId: string;
  scopes: string[];
}

// Verified keys are cached briefly (by sha256 of the key) so argon2 runs once per key per minute.
const verified = new Map<string, { caller: ApiCaller; until: number }>();

async function authenticate(req: Request): Promise<ApiCaller | null> {
  const m = /^Bearer\s+(mk_live_[0-9a-f]{12})_([A-Za-z0-9_-]{20,64})$/.exec(
    req.headers.get("authorization") ?? "",
  );
  if (!m) return null;
  const key = `${m[1]}_${m[2]}`;
  const fp = createHash("sha256").update(key).digest("hex");
  const hit = verified.get(fp);
  if (hit && hit.until > Date.now()) return hit.caller;
  const row = await withService(server().db, async (tx) => {
    const [k] = await tx
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.prefix, m[1]!), isNull(apiKeys.revokedAt)));
    if (k) await tx.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, k.id));
    return k ?? null;
  });
  if (!row || !(await argonVerify(row.hash, key))) return null;
  const caller = { keyId: row.id, workspaceId: row.workspaceId, scopes: row.scopes };
  verified.set(fp, { caller, until: Date.now() + 60_000 });
  return caller;
}

/** Revoking must take effect at once in this process. */
export function forgetVerifiedKeys() {
  verified.clear();
}

// ---------------------------------------------------------------- rate limit

const g = globalThis as typeof globalThis & { __makvidRedis?: Redis };
function redis(): Redis {
  g.__makvidRedis ??= new Redis(process.env.VALKEY_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });
  return g.__makvidRedis;
}

/** Fixed one-minute window per key. Returns seconds to wait when over the limit. */
export async function rateLimit(keyId: string, limit = RATE_LIMIT_PER_MIN): Promise<number | null> {
  const now = Date.now();
  const window = Math.floor(now / 60_000);
  const k = `${process.env.QUEUE_PREFIX || "mkv"}:rl:${keyId}:${window}`;
  const n = await redis().incr(k);
  if (n === 1) await redis().expire(k, 61);
  return n > limit ? Math.max(1, Math.ceil(((window + 1) * 60_000 - now) / 1000)) : null;
}

// ---------------------------------------------------------------- handler wrapper

export interface ApiContext {
  caller: ApiCaller;
  req: Request;
}

/**
 * Wrap a /api/v1 handler: API key, scope, plan (api_enabled), rate limit, Idempotency-Key (POST), errors.
 */
export async function apiHandler(
  req: Request,
  scope: Scope,
  fn: (c: ApiContext, body?: string) => Promise<Response>,
): Promise<Response> {
  try {
    const caller = await authenticate(req);
    if (!caller) return apiError("unauthorized");
    if (!caller.scopes.includes(scope)) return apiError("forbidden");
    const wait = await rateLimit(caller.keyId);
    if (wait !== null) return apiError("rate_limited", { headers: { "Retry-After": String(wait) } });
    if (!(await planOf(server().db, caller.workspaceId)).limits.api_enabled) return apiError("api_disabled");

    const idem = req.method === "POST" ? req.headers.get("idempotency-key") : null;
    if (!idem) return await fn({ caller, req });
    if (idem.length > 255) return apiError("invalid", { hint: "Idempotency-Key is at most 255 characters." });
    const isJson = (req.headers.get("content-type") ?? "").includes("json");
    const body = isJson ? await req.text() : "";
    const requestHash = createHash("sha256")
      .update(`${req.method} ${new URL(req.url).pathname}\n${body}`)
      .digest("hex");
    const db = server().db;
    const [prev] = await withWorkspace(db, caller.workspaceId, (tx) =>
      tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, idem)),
    );
    if (prev) {
      if (prev.requestHash !== requestHash) return apiError("idempotency_mismatch");
      if (prev.status === null) return apiError("idempotency_in_progress");
      return Response.json(prev.response, {
        status: prev.status,
        headers: { "Idempotent-Replayed": "true" },
      });
    }
    const claimed = await withWorkspace(db, caller.workspaceId, (tx) =>
      tx
        .insert(idempotencyKeys)
        .values({ workspaceId: caller.workspaceId, key: idem, requestHash })
        .onConflictDoNothing()
        .returning(),
    );
    if (!claimed.length) return apiError("idempotency_in_progress");
    let res: Response;
    try {
      res = await fn({ caller, req }, isJson ? body : undefined);
    } catch (e) {
      await withWorkspace(db, caller.workspaceId, (tx) =>
        tx.delete(idempotencyKeys).where(eq(idempotencyKeys.key, idem)),
      );
      throw e;
    }
    const json = (await res
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null;
    // Only final answers are stored; server errors may be retried with the same key.
    if (res.status < 500)
      await withWorkspace(db, caller.workspaceId, (tx) =>
        tx
          .update(idempotencyKeys)
          .set({ status: res.status, response: json })
          .where(eq(idempotencyKeys.key, idem)),
      );
    else
      await withWorkspace(db, caller.workspaceId, (tx) =>
        tx.delete(idempotencyKeys).where(eq(idempotencyKeys.key, idem)),
      );
    return res;
  } catch (e) {
    if (e instanceof QuotaError) return apiError("quota_exceeded", { reason: e.reason as QuotaDenial });
    if (e instanceof ProjectError) return apiError(e.code === "invalid" ? "invalid" : e.code);
    console.error("api v1 error", e);
    return apiError("generic");
  }
}

/** JSON body of a request, from the text already read for idempotency or from the request. */
export async function jsonBody(c: ApiContext, raw?: string): Promise<unknown> {
  try {
    return raw !== undefined ? JSON.parse(raw) : await c.req.json();
  } catch {
    return null;
  }
}
