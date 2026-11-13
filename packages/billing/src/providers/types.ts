// PaymentProvider (ADR 0004, T140): checkout creation + webhook verification/parsing. Granting plans or credits
// happens in ../payments.ts, the same for every provider, idempotently per event.

export interface CheckoutRequest {
  workspaceId: string;
  /** Our payment_orders id (Polar metadata / PayOS orderCode mapping). */
  orderId: string;
  kind: "plan" | "credits";
  /** Amount in the provider currency: USD (Polar) or VND integer (PayOS). */
  amount: number;
  /** Polar: product id of the plan or credit pack. */
  productId?: string;
  /** PayOS: integer order code (unique per merchant). */
  orderCode?: number;
  /** PayOS bank memo (≤ 9 characters for banks not linked through PayOS). */
  description: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  url: string;
  providerRef: string;
}

/** A verified, provider-neutral payment event. */
export type PaymentEvent =
  | {
      kind: "paid";
      eventId: string;
      /** Our order id (Polar metadata.order_id) or the PayOS orderCode. */
      orderId?: string;
      orderCode?: number;
      amount: number;
      currency: "USD" | "VND";
      /** Polar subscription id when the payment renews/starts a subscription. */
      subscriptionRef?: string;
      periodStart?: Date;
      periodEnd?: Date;
      workspaceId?: string;
      productId?: string;
    }
  | {
      kind: "subscription";
      eventId: string;
      subscriptionRef: string;
      status: "active" | "canceled" | "past_due" | "revoked";
      periodStart: Date;
      periodEnd: Date;
      cancelAt?: Date;
      workspaceId?: string;
      productId?: string;
    }
  | { kind: "refund"; eventId: string; orderId?: string; amount: number }
  | { kind: "ignored"; eventId: string; type: string };

export class WebhookVerificationError extends Error {
  constructor(message = "webhook signature invalid") {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export interface PaymentProvider {
  readonly id: "polar" | "payos" | "mock";
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Verify the raw body + headers and turn it into an event. Throws WebhookVerificationError. */
  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<PaymentEvent>;
}
