// POST: invite someone by email with a role. The link (with its one-time token) is returned once.
import { z } from "zod";
import { fail, guarded } from "@/server/api";
import { invite } from "@/server/members";

const Body = z.object({ email: z.string().max(254), role: z.enum(["admin", "editor", "viewer"]) });

export function POST(req: Request) {
  return guarded("POST /api/workspace/invitations", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const { id, token } = await invite(v, b.data.email, b.data.role);
    const base = process.env.APP_URL ?? new URL(req.url).origin;
    return Response.json({ id, link: `${base}/invite/${token}` }, { status: 201 });
  });
}
