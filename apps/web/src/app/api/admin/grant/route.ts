// POST: put a workspace on a plan for N days without payment (platform admins only).
import { z } from "zod";
import { fail, guarded } from "@/server/api";
import { grantPlan } from "@/server/admin";

const Body = z.object({
  workspaceId: z.string().uuid(),
  planId: z.string().regex(/^[a-z0-9_-]{2,32}$/),
  days: z.number().int().min(1).max(3660),
});

export function POST(req: Request) {
  return guarded(async (v) => {
    if (!v.isPlatformAdmin) return fail("forbidden");
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    await grantPlan(b.data.workspaceId, b.data.planId, b.data.days, v.userId);
    return Response.json({ ok: true });
  });
}
