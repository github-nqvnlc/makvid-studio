// POST: delete several projects permanently: by ids (1-100) or everything matching a filter (typed confirmation).
import { z } from "zod";
import { enqueuePurges, tombstoneProjects } from "@makvid/pipeline";
import { FilterSchema } from "@/lib/project-query";
import { fail, guarded } from "@/server/api";
import { server } from "@/server/deps";
import { matchingIds } from "@/server/projects-list";

export const dynamic = "force-dynamic";

const CHUNK = 100;
const MAX_CHUNKS = 1000;
const Body = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }),
  z.object({ filter: FilterSchema, confirm: z.enum(["XOA", "DELETE"]) }),
]);

export function POST(req: Request) {
  return guarded("POST /api/projects/delete", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const { deps, db } = server();
    let deleted = 0;
    let failed = 0;
    if ("ids" in b.data) {
      const ids = [...new Set(b.data.ids)];
      const done = await tombstoneProjects(deps, v.workspaceId, ids);
      await enqueuePurges(deps.connection, deps.prefix, v.workspaceId, done);
      deleted = done.length;
      failed = ids.length - done.length;
    } else {
      // Tombstoned rows stop matching, so asking for the first chunk again walks through the whole set.
      for (let i = 0; i < MAX_CHUNKS; i++) {
        const ids = await matchingIds(db, v.workspaceId, b.data.filter, CHUNK);
        if (!ids.length) break;
        const done = await tombstoneProjects(deps, v.workspaceId, ids);
        await enqueuePurges(deps.connection, deps.prefix, v.workspaceId, done);
        deleted += done.length;
        failed += ids.length - done.length;
        if (!done.length) break;
      }
    }
    return Response.json({ deleted, failed });
  });
}
