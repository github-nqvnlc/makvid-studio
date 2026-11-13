// GET: webhook endpoints with recent deliveries. POST: add an endpoint; its signing secret is returned once.
import { z } from "zod";
import { fail, guarded } from "@/server/api";
import { addWebhook, listWebhooks } from "@/server/webhook-endpoints";

export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().trim().max(2000),
  events: z
    .array(z.enum(["video.completed", "video.failed", "batch.completed"]))
    .min(1)
    .default(["video.completed", "video.failed", "batch.completed"]),
});

export function GET() {
  return guarded("GET /api/workspace/webhooks", async (v) =>
    Response.json({ endpoints: await listWebhooks(v.workspaceId) }),
  );
}

export function POST(req: Request) {
  return guarded("POST /api/workspace/webhooks", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    return Response.json(await addWebhook(v.workspaceId, b.data.url, b.data.events), { status: 201 });
  });
}
