// Route-handler helpers: auth guard + error mapping. Clients only ever get an error *code* that the UI
// turns into a friendly sentence; technical details stay in the server log (constitution V).
import "server-only";
import { ProjectError } from "@makvid/pipeline";
import { viewer, type Viewer } from "./session";

export type ApiErrorCode =
  | ProjectError["code"]
  | "unauthorized"
  | "generic"
  | "file_type"
  | "file_too_large"
  | "file_empty"
  | "source_unreachable"
  | "source_unreadable";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  invalid: 400,
  busy: 409,
  conflict: 409,
  nothing_to_undo: 409,
  nothing_to_redo: 409,
  generic: 500,
  file_type: 415,
  file_too_large: 413,
  file_empty: 400,
  source_unreachable: 422,
  source_unreadable: 422,
};

export const fail = (code: ApiErrorCode) => Response.json({ error: code }, { status: STATUS[code] });

export async function guarded(fn: (v: Viewer) => Promise<Response>): Promise<Response> {
  try {
    const v = await viewer();
    if (!v) return fail("unauthorized");
    return await fn(v);
  } catch (e) {
    if (e instanceof ProjectError) return fail(e.code);
    console.error("api error", e);
    return fail("generic");
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Route params are user input: only UUIDs reach the database. */
export function projectId(id: string): string {
  if (!UUID.test(id)) throw new ProjectError("not_found");
  return id;
}
