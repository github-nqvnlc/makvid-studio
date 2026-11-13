// Development only (MAKVID_PAYMENTS=mock): a fake checkout page that "pays" an order through the same
// signed-webhook path as real providers. Not available when the mock provider is off.
import { eq } from "drizzle-orm";
import { handlePaymentEvent, signMock } from "@makvid/billing";
import { paymentOrders, withWorkspace } from "@makvid/db";
import { guarded, uuidParam } from "@/server/api";
import { payments, server } from "@/server/deps";

export const dynamic = "force-dynamic";

const page = (orderId: string, amount: string, currency: string) => `<!doctype html><html lang="vi"><head>
<meta charset="utf-8"><title>Thanh toán thử</title><meta name="viewport" content="width=device-width">
<style>body{font:16px system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem}button{font:inherit;padding:.6rem 1.2rem}</style>
</head><body><h1>Thanh toán thử (môi trường phát triển)</h1><p>Số tiền: <b>${amount} ${currency}</b></p>
<form method="post"><input type="hidden" name="order" value="${orderId}"><button>Xác nhận đã thanh toán</button></form>
</body></html>`;

export function GET(req: Request) {
  return guarded("POST /api/billing/checkout", async (v) => {
    if (!payments().providers.mock) return new Response(null, { status: 404 });
    const orderId = uuidParam(new URL(req.url).searchParams.get("order") ?? "");
    const [o] = await withWorkspace(server().db, v.workspaceId, (tx) =>
      tx.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)),
    );
    if (!o) return new Response(null, { status: 404 });
    return new Response(page(o.id, o.amount, o.currency), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  });
}

export function POST(req: Request) {
  return guarded("POST /api/billing/checkout", async (v) => {
    const mock = payments().providers.mock;
    if (!mock) return new Response(null, { status: 404 });
    const orderId = uuidParam(String((await req.formData()).get("order") ?? ""));
    const [o] = await withWorkspace(server().db, v.workspaceId, (tx) =>
      tx.select().from(paymentOrders).where(eq(paymentOrders.id, orderId)),
    );
    if (!o) return new Response(null, { status: 404 });
    const body = JSON.stringify({
      eventId: `mock_${o.id}`,
      orderId: o.id,
      amount: Number(o.amount),
      currency: o.currency,
    });
    const event = await mock.parseWebhook(body, {
      "x-mock-signature": signMock(process.env.MAKVID_SECRET_KEY ?? "dev-mock-secret", body),
    });
    await handlePaymentEvent(server().db, "mock", event);
    const base = process.env.APP_URL ?? new URL(req.url).origin;
    return Response.redirect(`${base}/vi/workspace/billing?paid=1`, 303);
  });
}
