// POST /api/v1/videos: create a video from a prompt, a script or an article URL (contract CreateVideoRequest).
import { z } from "zod";
import { apiError, apiHandler, jsonBody } from "@/server/public-api";
import { SourceError, startVideo } from "@/server/videos";

export const dynamic = "force-dynamic";

const Aspect = z.enum(["16:9", "9:16", "1:1", "4:5"]);
const Body = z.object({
  source: z.union([
    z.object({ prompt: z.string().trim().min(3).max(4000) }).strict(),
    z.object({ script: z.string().trim().min(10).max(20000) }).strict(),
    z.object({ url: z.string().trim().url().max(2000) }).strict(),
  ]),
  aspects: z.array(Aspect).min(1).max(4).default(["9:16"]),
  targetDurationSec: z.number().int().min(30).max(600).default(45),
  styleId: z
    .string()
    .regex(/^[a-z0-9-]{2,40}$/)
    .optional(),
  voiceId: z.string().max(80).optional(),
  captions: z.boolean().default(true),
});

export function POST(req: Request) {
  return apiHandler(req, "videos:write", async (c, raw) => {
    const b = Body.safeParse(await jsonBody(c, raw));
    if (!b.success) return apiError("invalid", { hint: b.error.issues[0]?.path.join(".") || undefined });
    try {
      const id = await startVideo(c.caller.workspaceId, null, {
        source: b.data.source,
        aspects: [...new Set(b.data.aspects)],
        durationSec: b.data.targetDurationSec,
        ...(b.data.styleId ? { styleId: b.data.styleId } : {}),
        ...(b.data.voiceId ? { voiceId: b.data.voiceId } : {}),
      });
      return Response.json({ id, status: "queued" }, { status: 202 });
    } catch (e) {
      if (e instanceof SourceError)
        return apiError("invalid", {
          hint:
            e.code === "source_unreachable" ? "The URL could not be opened." : "No readable content found.",
        });
      throw e;
    }
  });
}
