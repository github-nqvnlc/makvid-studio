// POST: run only the failed rows again.
import { retryFailedRows } from "@makvid/pipeline";
import { guarded, uuidParam } from "@/server/api";
import { gate } from "@/server/batches";
import { server } from "@/server/deps";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded("POST /api/batches/[id]/retry", async (v) =>
    Response.json({
      retried: await retryFailedRows(server().deps, v.workspaceId, uuidParam((await params).id), gate()),
    }),
  );
}
