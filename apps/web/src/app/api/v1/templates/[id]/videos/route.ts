// POST /api/v1/templates/{id}/videos: one video from a template + variables.
import { z } from "zod";
import { attachReservation, reserve, settle } from "@makvid/billing";
import { createVideoFromTemplate, templateEstimate } from "@makvid/pipeline";
import { server } from "@/server/deps";
import { apiError, apiHandler, jsonBody } from "@/server/public-api";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Body = z.object({
  variables: z.record(z.string().max(40), z.union([z.string().max(2000), z.number()])),
  aspects: z
    .array(z.enum(["16:9", "9:16", "1:1", "4:5"]))
    .min(1)
    .max(4)
    .optional(),
});

export function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(req, "videos:write", async (c, raw) => {
    const { id } = await params;
    if (!UUID.test(id)) return apiError("not_found");
    const b = Body.safeParse(await jsonBody(c, raw));
    if (!b.success) return apiError("invalid");
    const values = Object.fromEntries(
      Object.entries(b.data.variables).map(([k, v]) => [k.toLowerCase(), String(v)]),
    );
    const ws = c.caller.workspaceId;
    const est = await templateEstimate(server().deps, ws, id, values);
    const r = await reserve(server().db, ws, {
      videoSeconds: est.videoSeconds,
      ttsChars: est.ttsChars,
      feature: "api",
    });
    try {
      const videoId = await createVideoFromTemplate(server().deps, {
        workspaceId: ws,
        userId: null,
        templateId: id,
        values,
        ...(b.data.aspects ? { aspects: [...new Set(b.data.aspects)] } : {}),
        onCreated: (pid) => attachReservation(server().db, ws, r.id, pid),
      });
      return Response.json({ id: videoId, status: "queued" }, { status: 202 });
    } catch (e) {
      await settle(server().db, ws, { reservationId: r.id }, false);
      throw e;
    }
  });
}
