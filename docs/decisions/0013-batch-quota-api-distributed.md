# ADR 0013 — M5: template batches, quota reservations, public API, scene-level distributed rendering

- **Status**: Accepted (2026-11-13)
- **Context**: M5 (US5, US6, US7, US9) adds batch production from a template + CSV, roles and plans with
  quota, payments (ADR 0004), a public API with webhooks, platform admin, and distributed rendering (SC-004).

## Decisions

1. **Templates are frozen VideoSpecs with `{{variables}}`** (narration and on-screen text, plus `{var}` slots).
   A batch row substitutes values and runs only voice → QA → render: no AI writing per row, so 100 rows cost
   100 × TTS and render, and every video has exactly the template's layout. Variable limits come from the
   style-pack slot `maxLength` minus the fixed text around the placeholder, so the CSV is checked before
   anything runs (missing columns, empty, too long, not a number).
2. **Batch orchestration in the database, not in a BullMQ flow tree**: `batch_items` rows are started by
   `advanceBatch` under a row lock on the batch (`SELECT … FOR UPDATE`), at most `concurrency` per batch and
   `concurrent_jobs` per workspace; workers call it when a row's render finishes or fails. Rows run at batch
   priority (10) so single videos (5) and previews (1) overtake them in every queue (tested). Retry resets only
   failed rows on the same projects. The ZIP is streamed (fflate) from object storage to a temp file and back.
3. **Quota = reservation before enqueue** (SC-008): `usage_periods` holds `used` and `reserved` counters, locked
   per reservation; a run commits the real amounts (never more than reserved) or releases everything; extra
   seconds come from bought credits (`credit_ledger`) and are refunded on failure. 10 concurrent requests on
   the free plan → exactly 3 accepted (tested).
4. **RLS escape hatches are explicit**: `app.scope = 'service'` (payment webhooks, API-key lookup, invitations,
   batch dispatch) and `app.scope = 'admin'` (read-only, platform admin). Every tenant table has the tenant,
   service and admin policies and nothing else (isolation suite checks the catalog).
5. **Public API**: keys `mk_live_<prefix>_<secret>`, argon2id hash, lookup by prefix; per-key fixed-window rate
   limit in Valkey; `Idempotency-Key` stored per workspace with the request hash; errors `{code, message,
hint}` in English without internal names. The OpenAPI file in `specs/…/contracts` is the single source of
   the docs page, `/api/v1/openapi.yaml` and the contract tests.
6. **Webhooks**: `X-MakVid-Signature: t=<unix>,v1=<hex HMAC-SHA256("t.body")>`, secrets AES-256-GCM at rest,
   one row per (endpoint, event) + BullMQ retries (8, exponential), delivered through the SSRF-safe fetch
   (no private addresses, no redirects for POST). The dispatcher runs inside worker-ai.
7. **Distributed rendering is scene-level**: scenes are already independent, deterministic and cached, so each
   uncached scene is zipped to object storage and rendered by whichever worker-render container takes the
   job (`RENDER_DISTRIBUTED=1`); finished scenes are shared through storage (scene cache key, per workspace).
   HyperFrames' frame-range chunking (`planV2`/`renderChunkV2`/`assembleV2`) is not used: it would add an
   assembly step and lose the per-scene cache that makes chat edits cheap (SC-009).

## Consequences

- A batch row's cost and look are predictable; changing the storyboard per row is not possible (by design).
- Scene fan-out cannot split a single very long scene; scenes are capped by templates (≤ ~10 s), so this is
  acceptable. Speed-up is bounded by the number of scenes in a video.
- Prices and limits of the paid plans and credit packs are placeholders until the product owner sets them
  (editable in the admin area without a deploy).
