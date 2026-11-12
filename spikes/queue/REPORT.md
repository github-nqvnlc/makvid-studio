# Spike T010 — BullMQ on Valkey

**Date**: 2026-11-12 · **Versions**: `bullmq@5.81.5`, `valkey/valkey:8` (server 8.1.11) · **Script**: [valkey-check.ts](valkey-check.ts)

| Feature we rely on | Result |
| --- | --- |
| Priorities: preview (1) > single (5) > batch (10) | PASS (processed `preview>single>batch`) |
| FlowProducer: `mux` parent runs after 3 `render_scene` children, reads children values | PASS |
| Rate limiter `{max: 2, duration: 1000}` on 6 jobs | PASS (≥2 s) |
| Idempotency via deterministic `jobId` (`version:step:hash`) | PASS (duplicate add ignored) |
| Retries with exponential backoff | PASS (succeeded on 3rd attempt) |

**Decision**: Valkey 8 is a drop-in backend for BullMQ for everything planned. Redis ≥ 8 is not needed
(and is excluded for licensing, research.md R4). Per-workspace concurrency will be enforced in our code
(semaphore keyed by workspace in Valkey) because BullMQ "groups" are a BullMQ Pro feature.

Run again:

```bash
docker run -d --rm --name makvid-valkey -p 6390:6379 valkey/valkey:8
```

```bash
npx tsx valkey-check.ts
```
