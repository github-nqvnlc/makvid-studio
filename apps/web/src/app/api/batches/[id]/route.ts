// GET: batch progress (counts, rows, signed links for finished videos and the ZIP).
import { batchView } from "@makvid/pipeline";
import { guarded, uuidParam } from "@/server/api";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded("GET /api/batches/[id]", async (v) =>
    Response.json(await batchView(server().deps, v.workspaceId, uuidParam((await params).id))),
  );
}
