// GET: the workspace's batches. POST (multipart: templateId, file, name?, concurrency?): create and start a
// batch. An invalid CSV creates nothing and returns the problems.
import { planOf } from "@makvid/billing";
import { createBatch } from "@makvid/pipeline";
import { fail, guarded, quotaFail, uuidParam } from "@/server/api";
import { gate, listBatches, readCsvUpload } from "@/server/batches";
import { server } from "@/server/deps";

export const dynamic = "force-dynamic";

export function GET() {
  return guarded("GET /api/batches", async (v) =>
    Response.json({ batches: await listBatches(v.workspaceId) }),
  );
}

export function POST(req: Request) {
  return guarded("POST /api/batches", async (v) => {
    const plan = await planOf(server().db, v.workspaceId);
    if (!plan.limits.batch_enabled) return quotaFail("batch_disabled");
    const form = await req.formData().catch(() => null);
    if (!form) return fail("invalid");
    const csv = await readCsvUpload(form);
    if (csv === "file_empty" || csv === "file_type" || csv === "file_too_large") return fail(csv);
    const name = String(form.get("name") ?? "").slice(0, 120);
    const concurrency = Math.min(
      plan.limits.concurrent_jobs,
      Math.max(1, Number(form.get("concurrency") ?? 2) || 2),
    );
    const r = await createBatch(
      server().deps,
      {
        workspaceId: v.workspaceId,
        userId: v.userId,
        templateId: uuidParam(String(form.get("templateId"))),
        csv,
        ...(name ? { name } : {}),
        concurrency,
      },
      gate(),
    );
    if (!r.ok)
      return Response.json(
        {
          error: "invalid",
          missingColumns: r.check.missingColumns,
          issues: r.check.issues,
          tooManyRows: r.check.tooManyRows,
        },
        { status: 400 },
      );
    return Response.json({ id: r.batchId, total: r.total }, { status: 201 });
  });
}
