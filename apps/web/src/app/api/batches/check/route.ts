// POST (multipart: templateId, file): check a CSV against the template before running. Nothing is written.
import { checkBatchCsv } from "@makvid/pipeline";
import { fail, guarded, uuidParam } from "@/server/api";
import { readCsvUpload } from "@/server/batches";
import { server } from "@/server/deps";

export function POST(req: Request) {
  return guarded("POST /api/batches/check", async (v) => {
    const form = await req.formData().catch(() => null);
    if (!form) return fail("invalid");
    const csv = await readCsvUpload(form);
    if (csv === "file_empty" || csv === "file_type" || csv === "file_too_large") return fail(csv);
    const r = await checkBatchCsv(
      server().deps,
      v.workspaceId,
      uuidParam(String(form.get("templateId"))),
      csv,
    );
    return Response.json({
      rows: r.rows.length,
      missingColumns: r.missingColumns,
      extraColumns: r.extraColumns,
      issues: r.issues,
      tooManyRows: r.tooManyRows,
      preview: r.rows.slice(0, 5),
    });
  });
}
