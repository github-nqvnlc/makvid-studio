// GET: the workspace's templates. POST: save a project as a template, turning chosen phrases into variables.
import { z } from "zod";
import { fail, guarded, uuidParam } from "@/server/api";
import { listTemplates, saveAsTemplate } from "@/server/templates";

export const dynamic = "force-dynamic";

const Body = z.object({
  projectId: z.string(),
  name: z.string().trim().min(1).max(120),
  replacements: z
    .array(
      z.object({
        find: z.string().trim().min(1).max(200),
        name: z.string().regex(/^[a-z_][a-z0-9_]{0,39}$/),
      }),
    )
    .min(1)
    .max(20),
});

export function GET() {
  return guarded("GET /api/templates", async (v) =>
    Response.json({ templates: await listTemplates(v.workspaceId) }),
  );
}

export function POST(req: Request) {
  return guarded("POST /api/templates", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const t = await saveAsTemplate(v, uuidParam(b.data.projectId), b.data.name, b.data.replacements);
    return Response.json({ id: t.id, variables: t.variables }, { status: 201 });
  });
}
