// POST: accept an invitation for the signed-in user, then switch to that workspace.
import { cookies } from "next/headers";
import { z } from "zod";
import { fail, guarded } from "@/server/api";
import { acceptInvitation, invitationInfo } from "@/server/members";
import { WORKSPACE_COOKIE } from "@/server/session";

const Body = z.object({ token: z.string().min(10).max(100) });

export function POST(req: Request) {
  return guarded(async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const info = await invitationInfo(b.data.token);
    const r = await acceptInvitation(b.data.token, v.userId, v.email);
    if (r !== "accepted") return Response.json({ error: r }, { status: r === "invalid" ? 404 : 403 });
    (await cookies()).set(WORKSPACE_COOKIE, info!.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return Response.json({ ok: true });
  });
}
