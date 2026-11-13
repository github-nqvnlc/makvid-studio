// GET /api/v1/videos/{id}: status, progress, outputs (contract Video).
import { apiError, apiHandler } from "@/server/public-api";
import { videoView } from "@/server/videos";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(req, "videos:read", async (c) => {
    const { id } = await params;
    const v = UUID.test(id) ? await videoView(c.caller.workspaceId, id) : null;
    return v ? Response.json(v) : apiError("not_found");
  });
}
