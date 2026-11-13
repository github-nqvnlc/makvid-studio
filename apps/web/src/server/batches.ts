// Batches (US5, T131/T133): web side of the batch flow, with the plan as gate (quota, concurrency, watermark).
import "server-only";
import { desc } from "drizzle-orm";
import { batches, withWorkspace } from "@makvid/db";
import { billingGate } from "@makvid/pipeline";
import { UploadError, validateUpload } from "./uploads";
import { server } from "./deps";
import type { ApiErrorCode } from "./api";

export const gate = () => billingGate(server().db);

export async function listBatches(workspaceId: string) {
  return withWorkspace(server().db, workspaceId, (tx) =>
    tx
      .select({
        id: batches.id,
        name: batches.name,
        status: batches.status,
        total: batches.total,
        succeeded: batches.succeeded,
        failed: batches.failed,
        createdAt: batches.createdAt,
      })
      .from(batches)
      .orderBy(desc(batches.createdAt))
      .limit(100),
  );
}

/** Read the uploaded CSV of a batch form: real type from the bytes, size limit, UTF-8 text. */
export async function readCsvUpload(form: FormData): Promise<string | ApiErrorCode> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return "file_empty";
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = validateUpload(bytes, "table");
    if (kind.ext !== "csv") return "file_type";
    return new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    if (e instanceof UploadError) return e.code;
    throw e;
  }
}
