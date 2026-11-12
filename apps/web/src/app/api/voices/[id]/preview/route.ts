// Pre-generated voice preview clip (T108a), served from packages/tts/library/voices.
import { readFile } from "node:fs/promises";
import { voiceCatalog, voicePreviewPath } from "@makvid/tts";
import { fail } from "@/server/api";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await ctx.params).id);
  if (!voiceCatalog().some((v) => v.id === id)) return fail("not_found");
  return new Response(new Uint8Array(await readFile(voicePreviewPath(id))), {
    headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=86400" },
  });
}
