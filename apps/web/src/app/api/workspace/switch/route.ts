// POST: switch the current workspace (must be one of the user's memberships).
import { cookies } from "next/headers";
import { z } from "zod";
import { fail, guarded } from "@/server/api";
import { WORKSPACE_COOKIE } from "@/server/session";

const Body = z.object({ workspaceId: z.string().uuid() });

export function POST(req: Request) {
  return guarded(async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success || !v.workspaces.some((w) => w.id === b.data.workspaceId)) return fail("invalid");
    (await cookies()).set(WORKSPACE_COOKIE, b.data.workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return Response.json({ ok: true });
  });
}
