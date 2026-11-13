// GET /api/v1/voices: Vietnamese voices (id, gender, region, tier, default).
import { voiceOptions } from "@/server/catalog";
import { apiHandler } from "@/server/public-api";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return apiHandler(req, "videos:read", async () => Response.json({ voices: voiceOptions() }));
}
