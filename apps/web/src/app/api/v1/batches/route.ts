// POST /api/v1/batches (multipart: templateId, file): run a batch from a template and a CSV.
import { planOf } from "@makvid/billing";
import { batchView, createBatch } from "@makvid/pipeline";
import { gate, readCsvUpload } from "@/server/batches";
import { server } from "@/server/deps";
import { apiError, apiHandler } from "@/server/public-api";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function POST(req: Request) {
  return apiHandler(req, "videos:write", async (c) => {
    const ws = c.caller.workspaceId;
    const plan = await planOf(server().db, ws);
    if (!plan.limits.batch_enabled) return apiError("quota_exceeded", { reason: "batch_disabled" });
    const form = await req.formData().catch(() => null);
    if (!form) return apiError("invalid", { hint: "Send multipart/form-data with templateId and file." });
    const templateId = String(form.get("templateId") ?? "");
    if (!UUID.test(templateId)) return apiError("invalid", { hint: "templateId" });
    const csv = await readCsvUpload(form);
    if (csv === "file_empty" || csv === "file_type" || csv === "file_too_large")
      return apiError("invalid", { hint: "file must be a non-empty CSV (UTF-8)." });
    const r = await createBatch(
      server().deps,
      { workspaceId: ws, userId: null, templateId, csv, concurrency: plan.limits.concurrent_jobs },
      gate(),
    );
    if (!r.ok) {
      const first = r.check.missingColumns.length
        ? `Missing columns: ${r.check.missingColumns.join(", ")}`
        : r.check.issues[0]
          ? `Row ${r.check.issues[0].row}, column ${r.check.issues[0].column}: ${r.check.issues[0].code}`
          : "The CSV has no rows.";
      return apiError("invalid", { hint: first });
    }
    const v = await batchView(server().deps, ws, r.batchId);
    return Response.json(
      { id: v.batch.id, status: v.batch.status, total: v.batch.total, succeeded: 0, failed: 0 },
      { status: 202 },
    );
  });
}
