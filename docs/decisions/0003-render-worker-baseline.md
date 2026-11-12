# ADR 0003 — Standard render worker: 8 vCPU / 16 GB RAM / no GPU

- **Status**: Accepted (product-owner decision, 2026-11-12)
- **Context**: M0 T006 measured ~12 fps with 4 HyperFrames workers on 8 vCPU (no gain past 4 workers),
  ≈ 20 min of simple video per worker-hour.
- **Decision**: one render container = 8 vCPU, 16 GB RAM, no GPU, `WORKERS=4`, `--shm-size 2g`. Scale out by
  adding containers (chunked rendering), not by bigger machines. Reference/golden renders run only in this
  Linux container image.
- **Consequences**: capacity planning and plan quotas use 20 min video/worker-hour until re-measured per heavy
  style pack (M1/M2). Payment gateway ADR moves to 0004.
