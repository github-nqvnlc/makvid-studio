// Mock payments for dev:mock and tests (MAKVID_PAYMENTS=mock): checkout returns a local URL that confirms
// the payment by calling our own webhook route with an HMAC-signed body. No network, no money.
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookVerificationError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
} from "./types";

export interface MockPaymentBody {
  eventId: string;
  orderId: string;
  amount: number;
  currency: "USD" | "VND";
}

export function signMock(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock" as const;
  constructor(
    private readonly secret: string,
    private readonly baseUrl: string,
  ) {}

  createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const u = new URL("/api/billing/mock-checkout", this.baseUrl);
    u.searchParams.set("order", req.orderId);
    return Promise.resolve({ url: u.toString(), providerRef: `mock_${req.orderId}` });
  }

  async parseWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<PaymentEvent> {
    const sig = headers["x-mock-signature"] ?? "";
    const want = Buffer.from(signMock(this.secret, rawBody), "hex");
    const got = Buffer.from(sig, "hex");
    if (got.length !== want.length || !timingSafeEqual(got, want)) throw new WebhookVerificationError();
    const b = JSON.parse(rawBody) as MockPaymentBody;
    return {
      kind: "paid",
      eventId: b.eventId,
      orderId: b.orderId,
      amount: b.amount,
      currency: b.currency,
    };
  }
}
