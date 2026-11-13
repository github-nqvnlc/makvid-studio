// GET /api/v1/videos/{id}/download?aspect=9:16: signed links that expire (FR-055).
import { apiError, apiHandler } from "@/server/public-api";
import { downloadLinks } from "@/server/videos";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(req, "videos:read", async (c) => {
    const { id } = await params;
    const aspect = new URL(req.url).searchParams.get("aspect") ?? undefined;
    if (aspect && !["16:9", "9:16", "1:1", "4:5"].includes(aspect)) return apiError("invalid");
    const links = UUID.test(id) ? await downloadLinks(c.caller.workspaceId, id, aspect) : null;
    return links ? Response.json(links) : apiError("not_found", { hint: "The video is not ready yet." });
  });
}
