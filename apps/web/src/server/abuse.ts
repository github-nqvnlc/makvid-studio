// Free-plan abuse signals (US6, T141; FR-050). At sign-up we store *hashed* signals only (HMAC with the server
// secret: no raw IP or device data): IP, a coarse device fingerprint and the email domain. A new account is
// marked "free_blocked" when the same IP or device already opened MAX_FREE_SIGNUPS accounts in 30 days, or
// when the email domain is a known disposable-mail service. Blocked accounts keep the app but get no free
// videos (paid plans are unaffected).
import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { abuseSignals, withService, type Db } from "@makvid/db";
import { isBlockedAddress } from "@makvid/media";

export const MAX_FREE_SIGNUPS = 3;
const WINDOW_DAYS = 30;

/** Short built-in list; extend from config if needed. */
const DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
]);

const hmac = (v: string) =>
  createHmac("sha256", process.env.MAKVID_SECRET_KEY ?? process.env.BETTER_AUTH_SECRET ?? "dev-secret")
    .update(v)
    .digest("hex")
    .slice(0, 32);

export interface SignupContext {
  ip: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
}

export function contextFrom(headers: Headers | undefined | null): SignupContext {
  const fwd = headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return {
    ip: fwd || headers?.get("x-real-ip") || null,
    userAgent: headers?.get("user-agent") ?? null,
    acceptLanguage: headers?.get("accept-language") ?? null,
  };
}

/** Pure decision (unit-tested). */
export function shouldBlock(o: { emailDomain: string; sameIp: number; sameDevice: number }): boolean {
  return DISPOSABLE.has(o.emailDomain) || o.sameIp >= MAX_FREE_SIGNUPS || o.sameDevice >= MAX_FREE_SIGNUPS;
}

/** Record a sign-up and return whether the new account gets the free plan. */
export async function recordSignup(
  db: Db,
  userId: string,
  email: string,
  ctx: SignupContext,
): Promise<boolean> {
  const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
  // No public IP (local development, tests, misconfigured proxy): only the email domain is checked.
  const ip = ctx.ip?.replace(/^::ffff:/, "") ?? "";
  const publicIp = isIP(ip) && !isBlockedAddress(ip) ? ip : null;
  const ipHash = publicIp ? hmac(`ip:${publicIp}`) : null;
  const deviceHash =
    publicIp && ctx.userAgent ? hmac(`dev:${ctx.userAgent}|${ctx.acceptLanguage ?? ""}|${publicIp}`) : null;
  return withService(db, async (tx) => {
    const since = new Date(Date.now() - WINDOW_DAYS * 86400_000);
    const count = async (
      col: typeof abuseSignals.ipHash | typeof abuseSignals.deviceHash,
      v: string | null,
    ) =>
      v
        ? ((
            await tx
              .select({ n: sql<number>`count(*)::int` })
              .from(abuseSignals)
              .where(and(eq(col, v), eq(abuseSignals.kind, "signup"), gt(abuseSignals.createdAt, since)))
          )[0]?.n ?? 0)
        : 0;
    const blocked = shouldBlock({
      emailDomain,
      sameIp: await count(abuseSignals.ipHash, ipHash),
      sameDevice: await count(abuseSignals.deviceHash, deviceHash),
    });
    await tx.insert(abuseSignals).values({ userId, ipHash, deviceHash, emailDomain, kind: "signup" });
    if (blocked)
      await tx.insert(abuseSignals).values({ userId, ipHash, deviceHash, emailDomain, kind: "free_blocked" });
    return !blocked;
  });
}

/** Whether any of these users (workspace owners) was refused the free plan. */
export async function freeBlocked(db: Db, userIds: string[]): Promise<boolean> {
  if (!userIds.length) return false;
  const rows = await withService(db, (tx) =>
    tx
      .select({ id: abuseSignals.id })
      .from(abuseSignals)
      .where(and(inArray(abuseSignals.userId, userIds), or(eq(abuseSignals.kind, "free_blocked"))))
      .limit(1),
  );
  return rows.length > 0;
}
