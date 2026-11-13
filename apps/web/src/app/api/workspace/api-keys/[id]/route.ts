// DELETE: revoke an API key (effective immediately).
import { guarded, uuidParam } from "@/server/api";
import { forgetVerifiedKeys, revokeApiKey } from "@/server/public-api";

export function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded("DELETE /api/workspace/api-keys/[id]", async (v) => {
    await revokeApiKey(v.workspaceId, uuidParam((await params).id));
    forgetVerifiedKeys();
    return Response.json({ ok: true });
  });
}
