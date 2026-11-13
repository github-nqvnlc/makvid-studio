// POST: resume a batch paused for quota (after an upgrade or new credits).
import { resumeBatch } from "@makvid/pipeline";
import { guarded, uuidParam } from "@/server/api";
import { gate } from "@/server/batches";
import { server } from "@/server/deps";

export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded("POST /api/batches/[id]/resume", async (v) =>
    Response.json(await resumeBatch(server().deps, v.workspaceId, uuidParam((await params).id), gate())),
  );
}
