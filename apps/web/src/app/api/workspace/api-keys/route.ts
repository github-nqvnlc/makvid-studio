// GET: the workspace's API keys (prefix only). POST: create a key; the full key is returned once.
import { z } from "zod";
import { fail, guarded } from "@/server/api";
import { createApiKey, listApiKeys } from "@/server/public-api";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z
    .array(z.enum(["videos:read", "videos:write"]))
    .min(1)
    .default(["videos:read", "videos:write"]),
});

export function GET() {
  return guarded("GET /api/workspace/api-keys", async (v) =>
    Response.json({ keys: await listApiKeys(v.workspaceId) }),
  );
}

export function POST(req: Request) {
  return guarded("POST /api/workspace/api-keys", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const k = await createApiKey(v.workspaceId, v.userId, b.data.name, [...new Set(b.data.scopes)]);
    return Response.json({ id: k.id, prefix: k.prefix, key: k.key }, { status: 201 });
  });
}
