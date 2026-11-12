// GET: the workspace's projects. POST: create a project and start production (T102).
import { desc, isNull } from "drizzle-orm";
import { z } from "zod";
import { projects, withWorkspace } from "@makvid/db";
import { createProject } from "@makvid/pipeline";
import { voiceCatalog } from "@makvid/tts";
import { fail, guarded } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET() {
  return guarded(async (v) => {
    const rows = await withWorkspace(server().db, v.workspaceId, (tx) =>
      tx
        .select({
          id: projects.id,
          title: projects.title,
          status: projects.status,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .where(isNull(projects.deletedAt))
        .orderBy(desc(projects.updatedAt)),
    );
    return Response.json({ projects: rows });
  });
}

const Body = z.object({
  prompt: z.string().trim().min(3).max(4000),
  aspect: z.enum(["9:16", "16:9", "1:1", "4:5"]),
  durationSec: z.number().int().min(30).max(180),
  mode: z.enum(["auto", "review"]),
  voiceId: z.string(),
});

export function POST(req: Request) {
  return guarded(async (v) => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("invalid");
    const b = parsed.data;
    if (!voiceCatalog().some((x) => x.id === b.voiceId)) return fail("invalid");
    const id = await createProject(server().deps, {
      workspaceId: v.workspaceId,
      userId: v.userId,
      prompt: b.prompt,
      aspects: [b.aspect],
      durationSec: b.durationSec,
      mode: b.mode,
      voiceId: b.voiceId,
    });
    return Response.json({ id }, { status: 201 });
  });
}
