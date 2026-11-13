// GET: the workspace's brand kit. PUT: save it (colours, logo, display/body fonts) — US8, T125.
import { z } from "zod";
import { BRAND_COLOR_KEYS, brandContrastIssues } from "@makvid/compiler";
import { fail, guarded } from "@/server/api";
import { getBrandKit, saveBrandKit } from "@/server/assets";
import { UploadError } from "@/server/uploads";

export const dynamic = "force-dynamic";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const Body = z.object({
  name: z.string().trim().max(80).default("Thương hiệu"),
  colors: z.partialRecord(z.enum(BRAND_COLOR_KEYS), hex).default({}),
  logoAssetId: z.uuid().nullable().default(null),
  logoPosition: z.enum(["top-left", "top-right"]).default("top-right"),
  fonts: z
    .object({ display: z.uuid().nullable().optional(), body: z.uuid().nullable().optional() })
    .default({}),
});

export function GET() {
  return guarded("GET /api/brand", async (v) => Response.json({ kit: await getBrandKit(v.workspaceId) }));
}

export function PUT(req: Request) {
  return guarded("PUT /api/brand", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const c = b.data.colors;
    // A partial palette mixes with the style's colours unpredictably: require the core four together.
    const core = (["bg", "fg", "accent", "accentInk"] as const).filter((k) => c[k]);
    if (core.length && core.length < 4) return fail("invalid");
    if (brandContrastIssues(c).length) return fail("brand_contrast");
    try {
      return Response.json({ id: await saveBrandKit(v.workspaceId, b.data) });
    } catch (e) {
      if (e instanceof UploadError) return fail(e.code);
      throw e;
    }
  });
}
