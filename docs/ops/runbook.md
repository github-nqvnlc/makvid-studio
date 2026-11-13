# Runbook (T168)

Operating MakVid Studio installed with `docker compose up -d` (see README). Commands run from the repo root.

## Services

| Service              | Network                     | Role                                                                 | Healthy when                     |
| -------------------- | --------------------------- | -------------------------------------------------------------------- | -------------------------------- |
| `web`                | internal + edge, port 3000  | UI, API, payment webhooks                                            | `GET /api/health` = 200          |
| `worker-ai`          | internal + edge             | script/style/storyboard stages, webhook deliveries, hourly retention | process up (logs `stage start`)  |
| `worker-audio`       | internal + edge             | voice, alignment calls, music mix                                    | process up                       |
| `worker-render`      | internal only (no internet) | QA, scene rendering (distributed), mux                               | process up; scale with `--scale` |
| `worker-align`       | internal                    | whisper.cpp + MFA (speech to text, word timing)                      | `/health`                        |
| `postgres`, `valkey` | internal                    | data, queues                                                         | healthcheck                      |
| `seaweedfs`          | internal + edge, port 8333  | object storage (S3 API); browsers download signed URLs               | `/status`                        |
| `backup`             | internal                    | daily `pg_dump` into `./backups`                                     | log line `backup ok`             |

## Production checklist

1. Secrets in `.env` changed from the examples (`POSTGRES_PASSWORD`, `S3_*`, `BETTER_AUTH_SECRET`,
   `MAKVID_SECRET_KEY`); `.env` readable only by the deploy user (`chmod 600 .env`).
2. HTTPS reverse proxy in front of `web` (3000) and `seaweedfs` (8333), e.g. Caddy:

   ```
   app.example.com   { reverse_proxy localhost:3000 }
   files.example.com { reverse_proxy localhost:8333 }
   ```

   then `APP_URL=https://app.example.com`, `BETTER_AUTH_URL=https://app.example.com`,
   `S3_PUBLIC_ENDPOINT=https://files.example.com`. Do not expose 5432/6379 (they are not published).

3. `MAKVID_PAYMENTS=polar` (and/or `payos`) with real keys; webhook URLs at the providers:
   `https://app.example.com/api/billing/webhooks/polar` and `…/payos`. `mock` is refused in production.
4. Offsite copy of `./backups` (rsync/rclone to another host or bucket) and a monthly restore test.
5. Monitoring: `METRICS_TOKEN` set and scraped (docs/ops/monitoring.md); alert on queue depth, failures,
   render speed and cost.
6. A platform admin account (README) to edit plan prices/limits at `/admin`.

## Routine operations

| Task                      | Command                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status                    | `docker compose ps`                                                                                                                                          |
| Logs (JSON lines)         | `docker compose logs -f --since 10m worker-render`                                                                                                           |
| More render capacity      | `docker compose up -d --scale worker-render=N` (each needs ~4 CPU / 4 GB by default; `RENDER_CPUS`, `RENDER_MEMORY`)                                         |
| Deploy a new version      | `git pull && docker compose up -d --build` (migrations run first in `migrate`)                                                                               |
| Backup now / test restore | `docker compose run --rm backup /backup/backup.sh` / `… /backup/restore-test.sh`                                                                             |
| Restore for real          | stop `web` and workers, then `docker compose exec -T postgres pg_restore -U makvid -d makvid --clean --if-exists < backups/makvid-<stamp>.dump`, start again |
| Retention                 | automatic every hour (worker-ai, `retention run` log); files older than the plan's `retention_days` are deleted                                              |
| Grant a plan by hand      | `/admin` → "Cấp gói" (workspace id, plan, days)                                                                                                              |

## Incidents

| Symptom                             | Check                                                             | Fix                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Videos stuck "đang làm"             | `/admin` queues: workers = 0?                                     | `docker compose up -d worker-render` (or the missing worker); look for `stage failed` in logs                     |
| Many failed videos                  | `docker compose logs worker-ai worker-audio \| grep '"level":50'` | provider key expired/quota (FPT dashboard), restart after fixing `.env`                                           |
| Downloads fail in the browser       | signed URL host                                                   | `S3_PUBLIC_ENDPOINT` must be the browser-reachable HTTPS host                                                     |
| Payment received but plan unchanged | `payment_events` row with `type = rejected`?                      | amount did not match the order (see logs `payment rejected`); grant by hand after checking the provider dashboard |
| Disk full                           | `docker system df`, `./backups`                                   | lower `BACKUP_KEEP_DAYS`, prune old images (`docker image prune`), check retention runs                           |
| Webhooks not arriving               | `/workspace/api` delivery list                                    | endpoint must be public HTTPS; private/internal addresses are refused by design                                   |

## Secrets rotation

- `BETTER_AUTH_SECRET`: rotating signs everyone out.
- `MAKVID_SECRET_KEY`: webhook secrets become unreadable — ask customers to re-create webhook endpoints
  (or re-encrypt before switching); abuse-signal hashes restart.
- Provider keys (FPT, Polar, PayOS…): change in `.env`, then `docker compose up -d`.
- Workspace API keys: customers revoke/create them on `/workspace/api`.
