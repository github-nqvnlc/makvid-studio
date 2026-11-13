// POST: start a checkout for a plan or a credit pack with Polar (cards) or PayOS (VietQR). Owner only.
import { z } from "zod";
import { PaymentError, startCheckout } from "@makvid/billing";
import { fail, guarded } from "@/server/api";
import { payments, server } from "@/server/deps";

const Body = z.object({
  provider: z.enum(["polar", "payos", "mock"]),
  item: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("plan"),
      planId: z.string().max(32),
      months: z.number().int().min(1).max(12).optional(),
    }),
    z.object({ kind: z.literal("credits"), packId: z.enum(["min30", "min120"]) }),
  ]),
  locale: z.enum(["vi", "en"]).default("vi"),
});

export function POST(req: Request) {
  return guarded("POST /api/billing/checkout", async (v) => {
    const b = Body.safeParse(await req.json().catch(() => null));
    if (!b.success) return fail("invalid");
    const p = payments();
    const provider = p.providers[b.data.provider];
    if (!provider) return fail("payments_unavailable");
    const base = process.env.APP_URL ?? new URL(req.url).origin;
    const back = `${base}/${b.data.locale}/workspace/billing`;
    try {
      const r = await startCheckout(server().db, {
        workspaceId: v.workspaceId,
        userId: v.userId,
        email: v.email,
        provider,
        item: b.data.item,
        successUrl: `${back}?paid=1`,
        cancelUrl: back,
        ...(b.data.item.kind === "credits" && p.packProducts[b.data.item.packId]
          ? { packProductId: p.packProducts[b.data.item.packId]! }
          : {}),
      });
      return Response.json({ url: r.url });
    } catch (e) {
      if (e instanceof PaymentError)
        return fail(e.code === "provider_unavailable" ? "payments_unavailable" : "invalid");
      console.error("checkout failed", (e as Error).message);
      return fail("payments_unavailable");
    }
  });
}
