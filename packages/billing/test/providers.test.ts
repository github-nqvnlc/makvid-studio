// Payment provider signatures against the providers' own documented vectors (ADR 0004).
import { describe, expect, it } from "vitest";
import {
  MockPaymentProvider,
  PayOsProvider,
  payOsDescription,
  payOsSign,
  PolarProvider,
  signMock,
  signStandardWebhook,
  verifyStandardWebhook,
  WebhookVerificationError,
} from "../src";

// Sample from payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature (read 2026-11-13).
const PAYOS_KEY = "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675";
const PAYOS_DATA = {
  orderCode: 123,
  amount: 3000,
  description: "VQRIO123",
  accountNumber: "12345678",
  reference: "TF230204212323",
  transactionDateTime: "2023-02-04 18:25:00",
  currency: "VND",
  paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
  code: "00",
  desc: "Thành công",
  counterAccountBankId: "",
  counterAccountBankName: "",
  counterAccountName: "",
  counterAccountNumber: "",
  virtualAccountName: "",
  virtualAccountNumber: "",
};
const PAYOS_SIG = "412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03";

describe("PayOS", () => {
  it("signs webhook data exactly like the documented sample", () => {
    expect(payOsSign(PAYOS_KEY, PAYOS_DATA)).toBe(PAYOS_SIG);
  });

  it("accepts the documented webhook and rejects a tampered amount", async () => {
    const p = new PayOsProvider({ clientId: "c", apiKey: "k", checksumKey: PAYOS_KEY });
    const body = { code: "00", desc: "success", success: true, data: PAYOS_DATA, signature: PAYOS_SIG };
    expect(await p.parseWebhook(JSON.stringify(body))).toEqual({
      kind: "paid",
      eventId: "124c33293c43417ab7879e14c8d9eb18:TF230204212323",
      orderCode: 123,
      amount: 3000,
      currency: "VND",
    });
    const tampered = { ...body, data: { ...PAYOS_DATA, amount: 3_000_000 } };
    await expect(p.parseWebhook(JSON.stringify(tampered))).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("creates a payment link with the documented signed fields", async () => {
    let sent: Record<string, unknown> = {};
    let headers: Record<string, string> = {};
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string) as Record<string, unknown>;
      headers = init.headers as Record<string, string>;
      return new Response(
        JSON.stringify({
          code: "00",
          data: { checkoutUrl: "https://pay.payos.vn/web/x", paymentLinkId: "x" },
        }),
      );
    }) as unknown as typeof fetch;
    const p = new PayOsProvider({
      clientId: "cid",
      apiKey: "akey",
      checksumKey: PAYOS_KEY,
      fetch: fakeFetch,
    });
    const s = await p.createCheckout({
      workspaceId: "w",
      orderId: "o",
      kind: "credits",
      amount: 230000,
      orderCode: 100001,
      description: "Mua thêm phút #100001",
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/cancel",
    });
    expect(s).toEqual({ url: "https://pay.payos.vn/web/x", providerRef: "x" });
    expect(headers).toMatchObject({ "x-client-id": "cid", "x-api-key": "akey" });
    expect(sent.description).toBe("MUATHEMPH");
    expect(sent.signature).toBe(
      payOsSign(PAYOS_KEY, {
        amount: 230000,
        cancelUrl: "https://app.test/cancel",
        description: "MUATHEMPH",
        orderCode: 100001,
        returnUrl: "https://app.test/ok",
      }),
    );
  });

  it("bank memo is ASCII and at most 9 characters", () => {
    expect(payOsDescription("Đơn hàng 12")).toBe("DONHANG12");
  });
});

describe("Polar (Standard Webhooks)", () => {
  const secret = `whsec_${Buffer.from("polar-test-secret-32-bytes-long!!").toString("base64")}`;
  const now = 1_763_000_000;

  it("verifies a signed delivery; rejects wrong secret, tampered body and old timestamps", () => {
    const body = '{"type":"order.paid","data":{}}';
    const sig = signStandardWebhook(secret, "msg_1", now, body);
    const h = {
      "webhook-id": "msg_1",
      "webhook-timestamp": String(now),
      "webhook-signature": `v1,bogus ${sig}`,
    };
    expect(() => verifyStandardWebhook(secret, body, h, now)).not.toThrow();
    expect(() => verifyStandardWebhook(secret, body.replace("{}", '{"x":1}'), h, now)).toThrow(
      WebhookVerificationError,
    );
    const other = `whsec_${Buffer.from("another-secret").toString("base64")}`;
    expect(() => verifyStandardWebhook(other, body, h, now)).toThrow(WebhookVerificationError);
    expect(() => verifyStandardWebhook(secret, body, h, now + 3600)).toThrow(/tolerance/);
  });

  it("maps order.paid (cents, net of tax) and subscription events", async () => {
    const p = new PolarProvider({ accessToken: "t", webhookSecret: secret });
    const ts = Math.floor(Date.now() / 1000);
    const deliver = (id: string, payload: unknown) => {
      const body = JSON.stringify(payload);
      return p.parseWebhook(body, {
        "webhook-id": id,
        "webhook-timestamp": String(ts),
        "webhook-signature": signStandardWebhook(secret, id, ts, body),
      });
    };
    const paid = await deliver("e1", {
      type: "order.paid",
      data: {
        id: "ord",
        net_amount: 1900,
        total_amount: 2090,
        currency: "usd",
        metadata: { order_id: "our-order", workspace_id: "ws" },
        subscription_id: "sub_1",
        subscription: {
          id: "sub_1",
          current_period_start: "2026-11-13T00:00:00Z",
          current_period_end: "2026-12-13T00:00:00Z",
        },
        product_id: "prod",
      },
    });
    expect(paid).toMatchObject({
      kind: "paid",
      orderId: "our-order",
      amount: 19,
      currency: "USD",
      subscriptionRef: "sub_1",
    });
    const canceled = await deliver("e2", {
      type: "subscription.canceled",
      data: {
        id: "sub_1",
        status: "active",
        cancel_at_period_end: true,
        current_period_start: "2026-11-13T00:00:00Z",
        current_period_end: "2026-12-13T00:00:00Z",
        ends_at: "2026-12-13T00:00:00Z",
        customer: { external_id: "ws" },
      },
    });
    expect(canceled).toMatchObject({ kind: "subscription", status: "canceled", workspaceId: "ws" });
    expect(await deliver("e3", { type: "benefit.granted", data: {} })).toEqual({
      kind: "ignored",
      eventId: "e3",
      type: "benefit.granted",
    });
  });

  it("creates a checkout pinned to the API version with our metadata", async () => {
    let req: { url: string; init: RequestInit } | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      req = { url, init };
      return new Response(JSON.stringify({ id: "chk", url: "https://polar.sh/checkout/x" }), { status: 201 });
    }) as unknown as typeof fetch;
    const p = new PolarProvider({
      accessToken: "tok",
      webhookSecret: secret,
      server: "sandbox",
      fetch: fakeFetch,
    });
    const s = await p.createCheckout({
      workspaceId: "ws",
      orderId: "o1",
      kind: "plan",
      amount: 19,
      productId: "prod",
      description: "",
      successUrl: "https://app.test/ok",
      cancelUrl: "https://app.test/back",
    });
    expect(s).toEqual({ url: "https://polar.sh/checkout/x", providerRef: "chk" });
    expect(req!.url).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
    expect(req!.init.headers).toMatchObject({ Authorization: "Bearer tok", "Polar-Version": "2026-10" });
    expect(JSON.parse(req!.init.body as string)).toMatchObject({
      products: ["prod"],
      external_customer_id: "ws",
      metadata: { order_id: "o1", workspace_id: "ws", kind: "plan" },
    });
  });
});

describe("mock provider", () => {
  it("only accepts bodies signed with the server secret", async () => {
    const m = new MockPaymentProvider("s3cret", "http://localhost:3000");
    const body = JSON.stringify({ eventId: "m1", orderId: "o", amount: 9, currency: "USD" });
    expect(await m.parseWebhook(body, { "x-mock-signature": signMock("s3cret", body) })).toMatchObject({
      kind: "paid",
    });
    await expect(m.parseWebhook(body, { "x-mock-signature": signMock("nope", body) })).rejects.toBeInstanceOf(
      WebhookVerificationError,
    );
  });
});
