// PATCH: change a member's role. DELETE: remove a member (or leave the workspace).
import { z } from "zod";
import { fail, guarded, uuidParam } from "@/server/api";
import { removeMember, setRole } from "@/server/members";

const Body = z.object({ role: z.enum(["admin", "editor", "viewer"]) });

export function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  return guarded("PATCH /api/workspace/members/[userId]", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    await setRole(v, uuidParam((await params).userId), b.data.role);
    return Response.json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const userId = (await params).userId;
  // Leaving is allowed for every member; removing others needs the "members" right.
  return guarded(async (v) => {
    const { can } = await import("@/server/rbac");
    if (userId !== v.userId && !can(v.role, "members")) return fail("forbidden");
    await removeMember(v, uuidParam(userId));
    return Response.json({ ok: true });
  });
}
