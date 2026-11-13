// DELETE: remove a webhook endpoint (pending deliveries are skipped).
import { guarded, uuidParam } from "@/server/api";
import { removeWebhook } from "@/server/webhook-endpoints";

export function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded("DELETE /api/workspace/webhooks/[id]", async (v) => {
    await removeWebhook(v.workspaceId, uuidParam((await params).id));
    return Response.json({ ok: true });
  });
}
