// POST {message}: one chat edit (T099) -> reply, and a new version being rendered when it was an edit.
import { z } from "zod";
import { chatProject } from "@makvid/pipeline";
import { fail, guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";
const Body = z.object({ message: z.string().trim().min(1).max(1000) });

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("POST /api/projects/[id]/chat", async (v) => {
    const id = projectId((await ctx.params).id);
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const s = server();
    return Response.json(await chatProject(s.deps, s.ai, v.workspaceId, id, b.data.message));
  });
}
