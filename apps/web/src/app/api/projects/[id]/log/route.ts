// GET: the activity log of a project's newest production run (spec 003, contracts/project-events.md).
// Text is localized here from message keys; nothing technical is ever stored or returned.
import { z } from "zod";
import { latestProgress, listEvents, runEvents, stageStates } from "@makvid/pipeline";
import { fail, guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

const Query = z.object({
  after: z.coerce.number().int().min(0).optional(),
  before: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  locale: z.enum(["vi", "en"]).optional(),
});

export function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("GET /api/projects/[id]/log", async (v) => {
    const id = projectId((await ctx.params).id);
    const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!q.success) return fail("invalid");
    const { db } = server();
    const progress = await latestProgress(db, v.workspaceId, id);
    if (!progress) return fail("not_found");
    const page = await listEvents(db, v.workspaceId, id, {
      ...(q.data.after !== undefined ? { after: q.data.after } : {}),
      ...(q.data.before !== undefined ? { before: q.data.before } : {}),
      ...(q.data.limit !== undefined ? { limit: q.data.limit } : {}),
      locale: q.data.locale ?? "vi",
    });
    const all = await runEvents(db, v.workspaceId, id);
    return Response.json({
      entries: page.entries,
      stages: stageStates(all, progress.status),
      status: progress.status,
      nextAfter: page.nextAfter,
      hasMore: page.hasMore,
    });
  });
}
