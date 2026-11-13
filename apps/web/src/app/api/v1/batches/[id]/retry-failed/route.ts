// POST /api/v1/batches/{id}/retry-failed: run only the failed rows again.
import { retryFailedRows } from "@makvid/pipeline";
import { gate } from "@/server/batches";
import { server } from "@/server/deps";
import { apiError, apiHandler } from "@/server/public-api";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(req, "videos:write", async (c) => {
    const { id } = await params;
    if (!UUID.test(id)) return apiError("not_found");
    const retried = await retryFailedRows(server().deps, c.caller.workspaceId, id, gate());
    return Response.json({ retried }, { status: 202 });
  });
}
