// POST {action}: undo / redo / restore {versionId} / duplicate (T100).
import { z } from "zod";
import { duplicateProject, redoProject, restoreVersion, undoProject } from "@makvid/pipeline";
import { fail, guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("undo") }),
  z.object({ action: z.literal("redo") }),
  z.object({ action: z.literal("duplicate") }),
  z.object({ action: z.literal("restore"), versionId: z.uuid() }),
]);

export function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded(async (v) => {
    const id = projectId((await ctx.params).id);
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const { deps } = server();
    switch (b.data.action) {
      case "undo":
        return Response.json({ headVersionId: await undoProject(deps, v.workspaceId, id) });
      case "redo":
        return Response.json({ headVersionId: await redoProject(deps, v.workspaceId, id) });
      case "restore":
        return Response.json({
          headVersionId: await restoreVersion(deps, v.workspaceId, id, b.data.versionId),
        });
      case "duplicate":
        return Response.json(
          { id: await duplicateProject(deps, v.workspaceId, id, v.userId) },
          { status: 201 },
        );
    }
  });
}
