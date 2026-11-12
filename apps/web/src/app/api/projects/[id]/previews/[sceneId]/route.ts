// Storyboard thumbnail of one scene (review mode), read from the project's work dir.
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { projects, withWorkspace } from "@makvid/db";
import { loadState, workDirOf } from "@makvid/pipeline";
import { fail, guarded, projectId } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET(_req: Request, ctx: { params: Promise<{ id: string; sceneId: string }> }) {
  return guarded(async (v) => {
    const p = await ctx.params;
    const id = projectId(p.id);
    // The project must be visible to this workspace (RLS) before any of its files are served.
    const [row] = await withWorkspace(server().db, v.workspaceId, (tx) =>
      tx.select({ id: projects.id }).from(projects).where(eq(projects.id, id)),
    );
    if (!row) return fail("not_found");
    const state = loadState(workDirOf(server().deps, v.workspaceId, id));
    const preview = state?.previews?.find((x) => x.sceneId === p.sceneId);
    if (!preview) return fail("not_found");
    return new Response(new Uint8Array(await readFile(preview.image)), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=300" },
    });
  });
}
