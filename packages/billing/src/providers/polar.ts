// Polar (ADR 0004): checkout sessions + Standard Webhooks. Docs read 2026-11-13:
//   POST {api}/v1/checkouts/  Authorization: Bearer <OAT>, Polar-Version: 2026-10
//   body { products: [uuid], success_url, return_url, external_customer_id, customer_email, metadata }
//   201 Checkout { id, url, ... }
// Webhooks: headers webhook-id / webhook-timestamp / webhook-signature ("v1,<base64>" entries separated by
// spaces), HMAC-SHA256 over "<id>.<timestamp>.<body>" with the base64-decoded part of the "whsec_" secret.
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookVerificationError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
} from "./types";

export const POLAR_API = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
} as const;
export const POLAR_VERSION = "2026-10";
const TOLERANCE_SEC = 5 * 60;

export interface PolarConfig {
  accessToken: string;
  webhookSecret: string;
  server?: keyof typeof POLAR_API;
  fetch?: typeof fetch;
}

/** Standard Webhooks signature check; returns nothing or throws. Exported for tests and other providers. */
export function verifyStandardWebhook(
  secret: string,
  body: string,
  headers: Record<string, string | undefined>,
  nowSec = Math.floor(Date.now() / 1000),
): void {
  const id = headers["webhook-id"];
  const ts = headers["webhook-timestamp"];
  const sig = headers["webhook-signature"];
  if (!id || !ts || !sig) throw new WebhookVerificationError("missing webhook headers");
  const t = Number(ts);
  if (!Number.isInteger(t) || Math.abs(nowSec - t) > TOLERANCE_SEC)
    throw new WebhookVerificationError("webhook timestamp outside tolerance");
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  const ok = sig.split(" ").some((part) => {
    const [version, value] = part.split(",", 2);
    if (version !== "v1" || !value) return false;
    const got = Buffer.from(value, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) throw new WebhookVerificationError();
}

/** Sign like Polar does (tests, local simulation). */
export function signStandardWebhook(secret: string, id: string, ts: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

interface PolarOrder {
  id: string;
  total_amount?: number;
  net_amount?: number;
  currency?: string;
  metadata?: Record<string, string>;
  customer?: { external_id?: string | null };
  subscription_id?: string | null;
  subscription?: { id: string; current_period_start?: string; current_period_end?: string | null } | null;
  product_id?: string | null;
  billing_reason?: string;
}
interface PolarSubscription {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end?: boolean;
  ends_at?: string | null;
  metadata?: Record<string, string>;
  customer?: { external_id?: string | null };
  product_id?: string;
}

export class PolarProvider implements PaymentProvider {
  readonly id = "polar" as const;
  private readonly base: string;
  private readonly doFetch: typeof fetch;
  constructor(private readonly cfg: PolarConfig) {
    this.base = POLAR_API[cfg.server ?? "production"];
    this.doFetch = cfg.fetch ?? fetch;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    if (!req.productId) throw new Error("polar checkout needs a product id");
    const res = await this.doFetch(`${this.base}/v1/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.cfg.accessToken}`,
        "Polar-Version": POLAR_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        products: [req.productId],
        success_url: req.successUrl,
        return_url: req.cancelUrl,
        external_customer_id: req.workspaceId,
        ...(req.customerEmail ? { customer_email: req.customerEmail } : {}),
        metadata: { order_id: req.orderId, workspace_id: req.workspaceId, kind: req.kind },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status !== 201) throw new Error(`polar checkout failed: HTTP ${res.status}`);
    const c = (await res.json()) as { id: string; url: string };
    return { url: c.url, providerRef: c.id };
  }

  async parseWebhook(rawBody: string, headers: Record<string, string | undefined>): Promise<PaymentEvent> {
    verifyStandardWebhook(this.cfg.webhookSecret, rawBody, headers);
    const eventId = headers["webhook-id"]!;
    const msg = JSON.parse(rawBody) as { type: string; data: unknown };
    switch (msg.type) {
      case "order.paid": {
        const o = msg.data as PolarOrder;
        const sub = o.subscription;
        return {
          kind: "paid",
          eventId,
          ...(o.metadata?.order_id ? { orderId: o.metadata.order_id } : {}),
          // net = after discounts, before tax (Polar adds tax as Merchant of Record)
          amount: (o.net_amount ?? o.total_amount ?? 0) / 100,
          currency: "USD",
          ...(o.subscription_id ? { subscriptionRef: o.subscription_id } : {}),
          ...(sub?.current_period_start ? { periodStart: new Date(sub.current_period_start) } : {}),
          ...(sub?.current_period_end ? { periodEnd: new Date(sub.current_period_end) } : {}),
          ...((o.metadata?.workspace_id ?? o.customer?.external_id)
            ? { workspaceId: (o.metadata?.workspace_id ?? o.customer?.external_id)! }
            : {}),
          ...(o.product_id ? { productId: o.product_id } : {}),
        };
      }
      case "subscription.active":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.revoked": {
        const s = msg.data as PolarSubscription;
        const status =
          msg.type === "subscription.revoked" || (s.status === "canceled" && !s.current_period_end)
            ? "revoked"
            : s.status === "past_due" || s.status === "unpaid"
              ? "past_due"
              : s.cancel_at_period_end || msg.type === "subscription.canceled"
                ? "canceled"
                : "active";
        return {
          kind: "subscription",
          eventId,
          subscriptionRef: s.id,
          status,
          periodStart: new Date(s.current_period_start),
          periodEnd: new Date(s.current_period_end ?? s.current_period_start),
          ...(s.ends_at ? { cancelAt: new Date(s.ends_at) } : {}),
          ...((s.metadata?.workspace_id ?? s.customer?.external_id)
            ? { workspaceId: (s.metadata?.workspace_id ?? s.customer?.external_id)! }
            : {}),
          ...(s.product_id ? { productId: s.product_id } : {}),
        };
      }
      case "order.refunded": {
        const o = msg.data as PolarOrder & { refunded_amount?: number };
        return {
          kind: "refund",
          eventId,
          ...(o.metadata?.order_id ? { orderId: o.metadata.order_id } : {}),
          amount: (o.refunded_amount ?? o.total_amount ?? 0) / 100,
        };
      }
      default:
        return { kind: "ignored", eventId, type: msg.type };
    }
  }
}
