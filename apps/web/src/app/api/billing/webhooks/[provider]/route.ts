// POST: payment provider webhooks (Polar, PayOS, mock). Signature verified on the raw body; every event is
// stored once (provider, event id) so redeliveries are harmless. No session: providers call this directly.
import { handlePaymentEvent, WebhookVerificationError } from "@makvid/billing";
import { payments, server } from "@/server/deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const id = (await params).provider;
  const provider = payments().providers[id as "polar" | "payos" | "mock"];
  if (!provider) return new Response(null, { status: 404 });
  const raw = await req.text();
  if (raw.length > 1_000_000) return new Response(null, { status: 413 });
  try {
    const event = await provider.parseWebhook(raw, Object.fromEntries(req.headers.entries()));
    const result = await handlePaymentEvent(server().db, provider.id, event);
    if (result === "rejected")
      console.warn("payment rejected (amount mismatch)", { provider: id, event: event.eventId });
    // PayOS expects a 2xx JSON answer; Polar accepts any 2xx.
    return Response.json({ ok: true, result }, { status: 200 });
  } catch (e) {
    if (e instanceof WebhookVerificationError) return new Response(null, { status: 403 });
    console.error("payment webhook failed", (e as Error).message);
    return new Response(null, { status: 500 });
  }
}
