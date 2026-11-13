# ADR 0004 — Payments: Polar (cards, subscriptions, worldwide) + PayOS (VietQR bank transfer, Vietnam)

- **Status**: Accepted (2026-11-13; product-owner decision)
- **Context**: US6 needs subscriptions and credit packs (T140). Research R8 compared Lemon Squeezy, Polar,
  Paddle, PayOS, VNPay and MoMo. The product owner chose the recommended pair: Polar for card payments and
  recurring plans (Merchant of Record, handles VAT/GST; Vietnam is a supported seller country) and PayOS for
  Vietnamese customers paying by VietQR bank transfer (needs a Vietnamese legal entity and bank account).

## Decision

Both sit behind `PaymentProvider` (`packages/billing/src/providers/`). Docs read 2026-11-13:

- **Polar** — `POST {https://api.polar.sh | https://sandbox-api.polar.sh}/v1/checkouts/`, `Authorization:
  Bearer <organization access token>`, pinned with `Polar-Version: 2026-10`. Body: `products` (product UUIDs,
  min 1), `success_url`, `return_url`, `external_customer_id` (= our workspace id), `customer_email`,
  `metadata`. Response 201 `Checkout { id, url, status, expires_at }`.
  Webhooks follow **Standard Webhooks**: headers `webhook-id`, `webhook-timestamp`, `webhook-signature`
  (`v1,<base64 HMAC-SHA256>` over `id.timestamp.body`, key = base64-decoded part after `whsec_`; Polar secrets
  created on or after 2026-09-08 use this scheme). Events used: `order.paid` (credits / renewal),
  `subscription.active`, `subscription.updated`, `subscription.canceled`, `subscription.revoked`. Unknown
  event types are acknowledged (202) so Polar does not retry.
- **PayOS** — `POST https://api-merchant.payos.vn/v2/payment-requests`, headers `x-client-id`, `x-api-key`.
  Body: `orderCode` (integer), `amount` (VND integer), `description` (≤ 9 characters for banks not linked
  through PayOS), `cancelUrl`, `returnUrl`, optional `expiredAt` (Unix int32), `signature` = hex HMAC-SHA256
  with the checksum key over `amount=…&cancelUrl=…&description=…&orderCode=…&returnUrl=…`. Response
  `{ code: "00", data: { checkoutUrl, paymentLinkId, qrCode, … }, signature }`.
  Webhook body `{ code, desc, success, data, signature }`; `signature` = HMAC-SHA256 over every `data` key
  sorted alphabetically as `k=v&…` (null/undefined → empty string). PayOS is one-off only: it sells credit
  packs and prepaid plan periods (monthly or yearly), never auto-renewing.
- **Idempotency**: every webhook is stored in `payment_events` with a unique `(provider, event_id)`; a repeat
  delivery is a no-op. Credits and plan changes are written in the same transaction as that row.
- **Prices** live in our `plans` table (USD for Polar product ids, VND for PayOS); the webhook amount is
  checked against the expected price before anything is granted.
- Local development uses `MAKVID_PAYMENTS=mock` (no network); keys live only in `.env`.

## Consequences

- Two webhooks to operate and monitor; refunds/chargebacks from Polar arrive as events and claw back credits.
- PayOS requires a registered business before going live; until then only Polar (and mock) are enabled.
- Privacy policy (M6) must list Polar and PayOS as payment processors.
