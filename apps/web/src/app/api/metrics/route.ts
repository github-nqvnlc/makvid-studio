// GET /api/metrics (T167; FR-058): Prometheus text format for queues, render speed and cost. Protected by
// METRICS_TOKEN (Authorization: Bearer ...); disabled (404) when the token is not configured.
import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { withAdmin } from "@makvid/db";
import { queueHealth } from "@/server/admin";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const token = process.env.METRICS_TOKEN;
  if (!token) return false;
  const got = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

const line = (name: string, value: number, labels: Record<string, string> = {}) => {
  const l = Object.entries(labels)
    .map(([k, v]) => `${k}="${v.replace(/["\\\n]/g, "_")}"`)
    .join(",");
  return `${name}${l ? `{${l}}` : ""} ${Number.isFinite(value) ? value : 0}`;
};

export async function GET(req: Request) {
  if (!process.env.METRICS_TOKEN) return new Response(null, { status: 404 });
  if (!authorized(req)) return new Response(null, { status: 401 });
  const out: string[] = [];
  const help = (name: string, type: "gauge" | "counter", text: string) =>
    out.push(`# HELP ${name} ${text}`, `# TYPE ${name} ${type}`);

  help("makvid_queue_jobs", "gauge", "Jobs per queue and state");
  help("makvid_queue_workers", "gauge", "Connected workers per queue");
  for (const q of await queueHealth()) {
    for (const [state, n] of Object.entries(q.counts))
      out.push(line("makvid_queue_jobs", n, { queue: q.name, state }));
    out.push(line("makvid_queue_workers", q.workers, { queue: q.name }));
  }

  // Last 24 hours, all workspaces (read-only admin scope).
  const [r] = (await withAdmin(server().db, (tx) =>
    tx.execute(sql`
      WITH outs AS (
        SELECT project_id, version_id, max(duration_ms) AS ms FROM render_outputs
        WHERE created_at > now() - interval '24 hours' GROUP BY project_id, version_id
      ), render AS (
        SELECT coalesce(sum(render_seconds), 0) AS s FROM usage_records
        WHERE step = 'render_scene' AND created_at > now() - interval '24 hours'
      ), cost AS (
        SELECT project_id, sum(cost_usd) AS usd FROM usage_records
        WHERE created_at > now() - interval '24 hours' AND project_id IS NOT NULL GROUP BY project_id
      )
      SELECT
        (SELECT count(*) FROM outs)::int AS videos,
        (SELECT coalesce(sum(ms), 0) FROM outs)::float / 60000 AS video_minutes,
        (SELECT s FROM render)::float AS render_seconds,
        (SELECT coalesce(avg(usd), 0) FROM cost)::float AS cost_per_video,
        (SELECT coalesce(sum(usd), 0) FROM cost)::float AS cost_total,
        (SELECT count(*) FROM projects WHERE status = 'failed' AND updated_at > now() - interval '24 hours')::int AS failed
    `),
  )) as unknown as [
    {
      videos: number;
      video_minutes: number;
      render_seconds: number;
      cost_per_video: number;
      cost_total: number;
      failed: number;
    },
  ];
  help("makvid_videos_24h", "gauge", "Videos rendered in the last 24 hours");
  out.push(line("makvid_videos_24h", r.videos));
  help("makvid_videos_failed_24h", "gauge", "Projects that failed in the last 24 hours");
  out.push(line("makvid_videos_failed_24h", r.failed));
  help("makvid_render_seconds_per_video_minute", "gauge", "Scene render time per minute of video (24 h)");
  out.push(
    line(
      "makvid_render_seconds_per_video_minute",
      r.video_minutes > 0 ? r.render_seconds / r.video_minutes : 0,
    ),
  );
  help("makvid_cost_usd_per_video", "gauge", "Average AI/voice cost per video (24 h)");
  out.push(line("makvid_cost_usd_per_video", r.cost_per_video));
  help("makvid_cost_usd_24h", "gauge", "Total AI/voice cost (24 h)");
  out.push(line("makvid_cost_usd_24h", r.cost_total));
  return new Response(`${out.join("\n")}\n`, { headers: { "content-type": "text/plain; version=0.0.4" } });
}
