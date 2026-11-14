// GET: redirect to a 5-minute signed URL of the user's picture, when the caller is that user or shares the
// current workspace with them. Anything else is a plain 404 (no hint whether the user exists).
import { eq } from "drizzle-orm";
import { memberships, users, withWorkspace } from "@makvid/db";
import { fail, guarded, uuidParam } from "@/server/api";
import { avatarKey } from "@/server/avatar";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return guarded(async (v) => {
    const userId = uuidParam((await ctx.params).userId);
    const { db, deps } = server();
    if (userId !== v.userId) {
      const shared = await withWorkspace(db, v.workspaceId, (tx) =>
        tx.select({ id: memberships.id }).from(memberships).where(eq(memberships.userId, userId)).limit(1),
      );
      if (!shared.length) return fail("not_found");
    }
    const [u] = await db.select({ image: users.image }).from(users).where(eq(users.id, userId));
    const version = u?.image ? new URL(u.image, "http://x").searchParams.get("v") : null;
    if (!version || !/^[0-9a-f]{8}\.(png|jpg|webp)$/.test(version)) return fail("not_found");
    const url = await deps.store.signedGetUrl(avatarKey(userId, version), 300);
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=300" } });
  });
}
