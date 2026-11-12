// Static style thumbnail for the style picker (T090 output).
import { readFile } from "node:fs/promises";
import { fail } from "@/server/api";
import { styleThumbnailFile } from "@/server/catalog";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const file = styleThumbnailFile((await ctx.params).id);
  if (!file) return fail("not_found");
  return new Response(new Uint8Array(await readFile(file)), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=86400" },
  });
}
