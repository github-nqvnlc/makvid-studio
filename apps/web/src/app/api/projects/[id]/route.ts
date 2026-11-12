// GET: everything the editor shows (head spec, outputs as signed URLs, versions, chat, review data).
import { projectView } from "@makvid/pipeline";
import { guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(async (v) => {
    const id = projectId((await ctx.params).id);
    return Response.json(await projectView(server().deps, v.workspaceId, id));
  });
}
