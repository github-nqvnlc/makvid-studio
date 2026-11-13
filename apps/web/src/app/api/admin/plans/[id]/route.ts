// PATCH: edit a plan's prices and limits (platform admins only).
import { z } from "zod";
import { fail, guarded } from "@/server/api";
import { updatePlan } from "@/server/admin";

const Limits = z.object({
  videos: z.number().int().min(0).nullable(),
  video_seconds: z.number().int().min(0).nullable(),
  tts_chars: z.number().int().min(0).nullable(),
  ai_images: z.number().int().min(0).nullable(),
  storage_bytes: z.number().int().min(0).nullable(),
  concurrent_jobs: z.number().int().min(1).max(64),
  max_video_seconds: z.number().int().min(30).max(600),
  batch_enabled: z.boolean(),
  api_enabled: z.boolean(),
  mediagen_enabled: z.boolean(),
});
const Body = z.object({
  priceUsd: z.number().min(0).max(100000),
  priceVnd: z.number().int().min(0).max(1_000_000_000),
  limits: Limits,
  watermark: z.boolean(),
  polarProductId: z.string().uuid().nullable(),
  active: z.boolean(),
});

export function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async (v) => {
    if (!v.isPlatformAdmin) return fail("forbidden");
    const id = (await params).id;
    if (!/^[a-z0-9_-]{2,32}$/.test(id)) return fail("not_found");
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    await updatePlan(id, b.data);
    return Response.json({ ok: true });
  });
}
