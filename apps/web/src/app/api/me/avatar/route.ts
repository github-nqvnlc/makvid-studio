// POST multipart `file`: set the profile picture. DELETE: remove it. Per-user, so any signed-in member may call.
import { fail, guarded } from "@/server/api";
import { clearAvatar, saveAvatar } from "@/server/avatar";
import { UploadError } from "@/server/uploads";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return guarded(async (v) => {
    const file = (await req.formData().catch(() => null))?.get("file");
    if (!(file instanceof File)) return fail("file_empty");
    try {
      const image = await saveAvatar(v.userId, new Uint8Array(await file.arrayBuffer()));
      return Response.json({ image });
    } catch (e) {
      if (e instanceof UploadError) return fail(e.code);
      throw e;
    }
  });
}

export function DELETE() {
  return guarded(async (v) => {
    await clearAvatar(v.userId);
    return new Response(null, { status: 204 });
  });
}
