// GET: everything the editor shows (head spec, outputs as signed URLs, versions, chat, review data).
// PATCH: rename. DELETE: permanent delete (tombstone now, files and rows purged by a background job).
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { projects, withWorkspace } from "@makvid/db";
import { enqueuePurges, projectView, tombstoneProjects } from "@makvid/pipeline";
import { fail, guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

const Rename = z.object({ title: z.string().transform((s) => s.normalize("NFC").trim()).pipe(z.string().min(1).max(200)) });

export function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("GET /api/projects/[id]", async (v) => {
    const id = projectId((await ctx.params).id);
    return Response.json(await projectView(server().deps, v.workspaceId, id));
  });
}

export function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("PATCH /api/projects/[id]", async (v) => {
    const id = projectId((await ctx.params).id);
    const b = Rename.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const [row] = await withWorkspace(server().db, v.workspaceId, (tx) =>
      tx
        .update(projects)
        .set({ title: b.data.title, updatedAt: new Date() })
        .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
        .returning({ id: projects.id, title: projects.title, updatedAt: projects.updatedAt }),
    );
    if (!row) return fail("not_found");
    return Response.json({ id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString() });
  });
}

export function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guarded("DELETE /api/projects/[id]", async (v) => {
    const id = projectId((await ctx.params).id);
    const { deps } = server();
    const done = await tombstoneProjects(deps, v.workspaceId, [id]);
    if (!done.length) return fail("not_found");
    await enqueuePurges(deps.connection, deps.prefix, v.workspaceId, done);
    return Response.json({ deleted: 1 });
  });
}
