// GET /api/health: liveness for the container healthcheck and load balancers. Checks the database and the
// queue store; answers only "ok" / "degraded" (no versions, hosts or error text).
import { sql } from "drizzle-orm";
import { Queue } from "bullmq";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export async function GET() {
  const { db, deps } = server();
  const checks = await Promise.allSettled([
    db.execute(sql`SELECT 1`),
    (async () => {
      const q = new Queue("ai", { connection: deps.connection, prefix: deps.prefix ?? "mkv" });
      try {
        await q.getJobCounts("waiting");
      } finally {
        await q.close();
      }
    })(),
  ]);
  const ok = checks.every((c) => c.status === "fulfilled");
  return Response.json({ status: ok ? "ok" : "degraded" }, { status: ok ? 200 : 503 });
}
