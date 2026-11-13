// GET: the workspace's images and fonts. POST (multipart: file, kind=image|font): upload into the library.
import { fail, guarded } from "@/server/api";
import { FontGlyphError, listAssets, saveAsset } from "@/server/assets";
import { UploadError } from "@/server/uploads";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return guarded(async (v) => {
    const kind = new URL(req.url).searchParams.get("kind");
    const kinds = kind === "image" || kind === "font" ? [kind] : ["image", "font"];
    return Response.json({ assets: await listAssets(v.workspaceId, kinds) });
  });
}

export function POST(req: Request) {
  return guarded(async (v) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const kind = form?.get("kind");
    if (!(file instanceof File) || (kind !== "image" && kind !== "font")) return fail("invalid");
    try {
      const r = await saveAsset(v.workspaceId, new Uint8Array(await file.arrayBuffer()), file.name, kind);
      return Response.json(r, { status: r.existing ? 200 : 201 });
    } catch (e) {
      if (e instanceof UploadError) return fail(e.code);
      if (e instanceof FontGlyphError) return fail("font_glyphs");
      throw e;
    }
  });
}
