# Monitoring (T167; FR-058)

Three sources, from quick look to alerting:

1. **Admin page** `/admin` (platform admins): queue depth and connected workers per queue, AI cost vs revenue
   per workspace, cost per pipeline step and provider.
2. **Structured logs** (pino JSON, one line per event) from every worker: `stage start` / `stage done` /
   `stage failed` with job id and project id, `scene rendered` with milliseconds, `webhook delivery failed`
   with the error code (never the endpoint URL), `retention run`. Containers keep 5 × 20 MB per service
   (`docker compose logs -f worker-render`). Ship them to Loki/Elastic with any Docker log driver.
3. **Prometheus endpoint** `GET /api/metrics` with `Authorization: Bearer $METRICS_TOKEN` (404 when the token
   is not set):

| Metric                                          | Meaning                                                                               | Suggested alert                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `makvid_queue_jobs{queue,state}`                | jobs per queue (`waiting`, `prioritized`, `active`, `delayed`, `failed`, `completed`) | `waiting+prioritized` of `render` > 50 for 15 min → add render workers |
| `makvid_queue_workers{queue}`                   | connected workers                                                                     | `ai`, `audio`, `render` = 0 for 2 min                                  |
| `makvid_render_seconds_per_video_minute`        | scene render time per minute of video, last 24 h                                      | > 600 (SC-004: one minute of video in 10 minutes)                      |
| `makvid_videos_24h`, `makvid_videos_failed_24h` | throughput and failures                                                               | failed / (videos + failed) > 10 %                                      |
| `makvid_cost_usd_per_video`                     | average AI + voice cost per video, last 24 h                                          | sudden 2× jump (provider price change, loop)                           |
| `makvid_cost_usd_24h`                           | total provider cost, last 24 h                                                        | over the daily budget                                                  |

Prometheus scrape example:

```yaml
scrape_configs:
  - job_name: makvid
    metrics_path: /api/metrics
    scheme: https
    authorization: { credentials_file: /etc/prometheus/makvid-token }
    static_configs: [{ targets: ["app.example.com"] }]
```

Grafana: one dashboard with the queue panel (stacked `makvid_queue_jobs` by state for `render`), render speed
(`makvid_render_seconds_per_video_minute` against a 600 s threshold line) and cost (`makvid_cost_usd_per_video`,
`makvid_cost_usd_24h`).

Health: `GET /api/health` → `{"status":"ok"}` (200) or `degraded` (503) when the database or Valkey is
unreachable; used by the container healthcheck and any load balancer.

Notes:

- Render seconds are recorded per render run (`usage_records.step = render_scene`); cache hits cost nothing,
  so the ratio drops after chat edits — that is expected (SC-009).
- Cost figures are the providers' list prices recorded at call time (FR-048); compare monthly with the
  provider invoices (SC-011, within 10 %).
