// PayOS (ADR 0004): VietQR bank transfer for Vietnamese customers, one-off payments only. Docs read 2026-11-13:
//   POST https://api-merchant.payos.vn/v2/payment-requests   headers x-client-id, x-api-key
//   body { orderCode, amount, description, cancelUrl, returnUrl, expiredAt?, signature }
//   signature = hex HMAC-SHA256(checksumKey, "amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=..")
//   response { code: "00", desc, data: { checkoutUrl, paymentLinkId, qrCode, ... }, signature }
// Webhook body { code, desc, success, data, signature }: signature over every `data` key sorted
// alphabetically as "k=v&..." (null/undefined -> "", arrays/objects as JSON with sorted keys).
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  WebhookVerificationError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
} from "./types";

export const PAYOS_API = "https://api-merchant.payos.vn";

export interface PayOsConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  fetch?: typeof fetch;
}

const sortKeys = (o: Record<string, unknown>) =>
  Object.fromEntries(
    Object.keys(o)
      .sort()
      .map((k) => [k, o[k]]),
  );

/** "k=v&..." over sorted keys, as the PayOS docs sample code builds it. */
export function payOsSignatureData(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((k) => {
      let v = data[k];
      if (v === null || v === undefined || v === "undefined" || v === "null") v = "";
      else if (Array.isArray(v))
        v = JSON.stringify(
          v.map((x) => (x && typeof x === "object" ? sortKeys(x as Record<string, unknown>) : x)),
        );
      else if (typeof v === "object") v = JSON.stringify(sortKeys(v as Record<string, unknown>));
      return `${k}=${String(v)}`;
    })
    .join("&");
}

export function payOsSign(checksumKey: string, data: Record<string, unknown>): string {
  return createHmac("sha256", checksumKey).update(payOsSignatureData(data)).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** PayOS bank memo: ASCII letters/digits only, at most 9 characters. */
export function payOsDescription(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 9);
}

interface PayOsWebhookData {
  orderCode: number;
  amount: number;
  description?: string;
  reference?: string;
  paymentLinkId?: string;
  code?: string;
  currency?: string;
  [k: string]: unknown;
}

export class PayOsProvider implements PaymentProvider {
  readonly id = "payos" as const;
  private readonly doFetch: typeof fetch;
  constructor(private readonly cfg: PayOsConfig) {
    this.doFetch = cfg.fetch ?? fetch;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    if (!req.orderCode || !Number.isSafeInteger(req.orderCode))
      throw new Error("payos needs an integer orderCode");
    if (!Number.isInteger(req.amount) || req.amount <= 0) throw new Error("payos amount must be whole VND");
    const signed = {
      amount: req.amount,
      cancelUrl: req.cancelUrl,
      description: payOsDescription(req.description),
      orderCode: req.orderCode,
      returnUrl: req.successUrl,
    };
    const res = await this.doFetch(`${PAYOS_API}/v2/payment-requests`, {
      method: "POST",
      headers: {
        "x-client-id": this.cfg.clientId,
        "x-api-key": this.cfg.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...signed,
        expiredAt: Math.floor(Date.now() / 1000) + 30 * 60,
        signature: payOsSign(this.cfg.checksumKey, signed),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => null)) as {
      code?: string;
      data?: { checkoutUrl: string; paymentLinkId: string };
    } | null;
    if (!res.ok || body?.code !== "00" || !body.data)
      throw new Error(`payos checkout failed: HTTP ${res.status} code ${body?.code}`);
    return { url: body.data.checkoutUrl, providerRef: body.data.paymentLinkId };
  }

  async parseWebhook(rawBody: string): Promise<PaymentEvent> {
    let msg: { code?: string; success?: boolean; data?: PayOsWebhookData; signature?: string };
    try {
      msg = JSON.parse(rawBody) as typeof msg;
    } catch {
      throw new WebhookVerificationError("invalid body");
    }
    if (!msg.data || !msg.signature) throw new WebhookVerificationError("missing data or signature");
    if (!safeEqualHex(payOsSign(this.cfg.checksumKey, msg.data), msg.signature))
      throw new WebhookVerificationError();
    const d = msg.data;
    const eventId = `${d.paymentLinkId ?? "link"}:${d.reference ?? d.orderCode}`;
    if (msg.code !== "00" || d.code !== "00")
      return { kind: "ignored", eventId, type: `payos:${d.code ?? msg.code}` };
    return { kind: "paid", eventId, orderCode: d.orderCode, amount: d.amount, currency: "VND" };
  }
}
