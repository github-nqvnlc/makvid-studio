// GET /api/v1/batches/{id}: batch progress (contract Batch).
import { batchView, ProjectError } from "@makvid/pipeline";
import { server } from "@/server/deps";
import { apiError, apiHandler } from "@/server/public-api";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(req, "videos:read", async (c) => {
    const { id } = await params;
    if (!UUID.test(id)) return apiError("not_found");
    try {
      const v = await batchView(server().deps, c.caller.workspaceId, id);
      return Response.json({
        id: v.batch.id,
        status: v.batch.status,
        total: v.batch.total,
        succeeded: v.batch.counts.succeeded,
        failed: v.batch.counts.failed,
        ...(v.batch.zip ? { zipUrl: v.batch.zip } : {}),
      });
    } catch (e) {
      if (e instanceof ProjectError) return apiError("not_found");
      throw e;
    }
  });
}
