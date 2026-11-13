// POST: cancel a batch (pending rows are dropped, running rows finish).
import { cancelBatch } from "@makvid/pipeline";
import { guarded, uuidParam } from "@/server/api";
import { server } from "@/server/deps";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded("POST /api/batches/[id]/cancel", async (v) => {
    await cancelBatch(server().deps, v.workspaceId, uuidParam((await params).id));
    return Response.json({ ok: true });
  });
}
