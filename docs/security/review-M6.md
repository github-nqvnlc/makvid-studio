# Security review — M6 (T163)

**Date**: 2026-11-14 · **Scope**: the whole stack as of M5 + M6 hardening · **Reviewer**: Claude Code
(self-review against the constitution, FR-054/055 and the threat list below; not an external audit).

Legend: ✅ in place and tested · ⚠️ in place with a known limit · ❌ missing (follow-up)

## 1. Sandbox for AI-generated content (FR-054)

| Control                                                   | Status | Evidence                                                                                                                                                                                                |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render workers have no internet route                     | ✅     | `docker/compose.yml`: `worker-render` only on the `internal: true` network; reference renders run with `--network none` (`scripts/verify-render.sh`, CI `render-smoke`)                                 |
| Scenes are self-contained                                 | ✅     | Compiler bundles fonts, GSAP and runtime into each scene dir; style lint `no-remote-url`; renderer request interception records blocked requests and QA fails the scene (`packages/renderer/src/qa.ts`) |
| Freeform (AI-written) HTML/JS/CSS restricted              | ✅     | `packages/compiler/src/freeform.ts` lint (no network APIs, no timers/random); scenes run in headless Chrome with no file access outside the scene dir                                                   |
| Distributed scene archives cannot write outside their dir | ✅     | `unzipInto` rejects absolute/`..` entries (test `integration/distributed.test.ts`)                                                                                                                      |

## 2. Network input (SSRF)

| Control                     | Status | Evidence                                                                                                                                                                                                                                     |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User URLs (article, GitHub) | ✅     | `safeFetch`: http/https on 80/443 only, every resolved address checked (private, loopback, link-local, metadata, CGNAT, NAT64, ULA…), connection pinned to the vetted IP (no DNS rebinding), redirects re-checked, size/time caps — 28 tests |
| Outgoing webhooks           | ✅     | Same `safeFetch` with POST; redirects never followed for POST; loopback/metadata/private refused (test `apps/web/test/webhooks.test.ts`)                                                                                                     |
| Test escape hatch           | ✅     | `MAKVID_WEBHOOK_TEST_PORT` only honoured when `MAKVID_MOCK_PROVIDERS=1`                                                                                                                                                                      |

## 3. Uploads

| Control                           | Status | Evidence                                                                                        |
| --------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| Type from the bytes, not the name | ✅     | `apps/web/src/server/uploads.ts` sniffing + allowlist per kind (`apps/web/test/upload.test.ts`) |
| Size/duration limits              | ✅     | data 2 MB, media 200 MB / 5 min, fonts and images limited; SVG sanitised (`safeSvg`)            |
| Fonts must render Vietnamese      | ✅     | glyph coverage check before accepting a brand font                                              |

## 4. Secrets and keys (FR-055)

| Control                                                           | Status | Evidence                                                                                                                                                                               |
| ----------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider keys (FPT, Google, ShopAIKey, Soundstripe, Polar, PayOS) | ✅     | Only in `.env` / container env; never stored in the database, never logged; `.env` git-ignored; repo scan for key patterns clean (2026-11-14)                                          |
| ShopAIKey key travels in the URL                                  | ⚠️     | Provider limitation (ADR 0011); request URLs are never logged and the error message omits the URL                                                                                      |
| Webhook signing secrets                                           | ✅     | AES-256-GCM at rest with a key derived from `MAKVID_SECRET_KEY`; shown once                                                                                                            |
| Workspace API keys                                                | ✅     | argon2id (OWASP baseline parameters), lookup by prefix, revocation immediate in-process                                                                                                |
| Key from KMS                                                      | ⚠️     | `MAKVID_SECRET_KEY` comes from env; a KMS/secret manager is a deployment choice (runbook)                                                                                              |
| No dev secrets in production compose                              | ✅     | `docker/compose.yml` requires `POSTGRES_PASSWORD`, `S3_*`, `MAKVID_SECRET_KEY`, `BETTER_AUTH_SECRET` (`:?`); SeaweedFS identity written from env at start (no credentials in the repo) |
| Mock payments in production                                       | ✅     | `paymentsFromEnv` refuses `MAKVID_PAYMENTS=mock` when `NODE_ENV=production`                                                                                                            |

## 5. Access control

| Control                          | Status | Evidence                                                                                                                                                                                            |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant isolation in the database | ✅     | FORCE RLS on every table with `workspace_id`; only tenant/service/admin policies (catalog test); cross-workspace read/delete refused table by table (`tests/isolation/workspace-isolation.test.ts`) |
| Roles                            | ✅     | One matrix (`apps/web/src/server/rbac.ts`); every session route names its permission (route-coverage test)                                                                                          |
| Platform admin                   | ✅     | `users.is_platform_admin` set only in SQL; admin scope is read-only in RLS; admin routes check the flag (test)                                                                                      |
| Public API                       | ✅     | key scopes, plan check, per-key rate limit (429 + Retry-After), Idempotency-Key                                                                                                                     |
| Auth rate limiting               | ⚠️     | Better Auth default (production only, in memory): per web instance; use the database/secondary storage when running several web instances                                                           |
| Payment webhooks                 | ✅     | Standard Webhooks (Polar) / HMAC over sorted data (PayOS, matches the documented vector), idempotent per event, amount checked against our order                                                    |

## 6. Data in transit / at rest

| Control                 | Status | Evidence                                                                                                              |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| Download links          | ✅     | Signed URLs, 1 hour TTL everywhere (`signedGetUrl(…, 3600)`); upload URLs 15 min                                      |
| Object keys             | ✅     | Always `ws/<workspaceId>/…`, traversal rejected (`assertKey`)                                                         |
| HTTP security headers   | ✅     | nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, HSTS in production (`apps/web/next.config.ts`) |
| Content-Security-Policy | ❌     | Not set: Next's inline runtime needs nonces; follow-up                                                                |
| TLS                     | ⚠️     | Terminated by the reverse proxy in front of `web` and the S3 endpoint (runbook); compose itself serves HTTP           |
| Backups                 | ✅     | Daily `pg_dump` with retention and a restore test (`docker/backup/`, T166)                                            |

## 7. User-facing errors

No technical names in the UI (E2E `no-tech-leak`), API errors are `{code, message, hint}` without internals,
webhook payloads carry ids/status/friendly message only.

## 8. Follow-ups

1. Content-Security-Policy with nonces (Next middleware).
2. Shared rate-limit storage for auth when the web tier is scaled out.
3. Move `MAKVID_SECRET_KEY` to the host's secret manager in production; document rotation (re-encrypt webhook
   secrets with a new key: endpoints can also simply be re-created).
4. External penetration test before public launch.
