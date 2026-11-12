// POST: accept / edit at a review point (US3) and continue production.
import { z } from "zod";
import { resumeProject } from "@makvid/pipeline";
import { fail, guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";
const Body = z.discriminatedUnion("point", [
  z.object({
    point: z.literal("script_review"),
    edits: z.object({
      title: z.string().max(200).optional(),
      sentences: z.array(z.string().max(400)).min(1).max(40).optional(),
      styleId: z.string().max(64).optional(),
    }),
  }),
  z.object({
    point: z.literal("storyboard_review"),
    edits: z.object({ dropSceneIds: z.array(z.string().max(64)).max(40).optional() }),
  }),
]);

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(async (v) => {
    const id = projectId((await ctx.params).id);
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    await resumeProject(server().deps, v.workspaceId, id, b.data);
    return Response.json({ ok: true });
  });
}
