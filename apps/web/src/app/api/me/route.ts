// PATCH {locale}: remember the signed-in user's language in their profile (spec FR-010). Per-user, not a
// workspace action, so any member may call it (guarded without a route key).
import { eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "@makvid/db";
import { fail, guarded } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

const Body = z.object({ locale: z.enum(["vi", "en"]) });

export async function PATCH(req: Request) {
  return guarded(async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    await server().db.update(users).set({ locale: b.data.locale, updatedAt: new Date() }).where(eq(users.id, v.userId));
    return new Response(null, { status: 204 });
  });
}
