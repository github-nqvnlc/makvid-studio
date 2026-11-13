// Route-handler helpers: auth guard, role check and error mapping. Clients only ever get an error *code* that
// the UI turns into a friendly sentence; technical details stay in the server log (constitution V).
import "server-only";
import { QuotaError, type QuotaDenial } from "@makvid/billing";
import { ProjectError } from "@makvid/pipeline";
import { can, ROUTES, type RouteKey } from "./rbac";
import { viewer, type Viewer } from "./session";

export type ApiErrorCode =
  | ProjectError["code"]
  | "unauthorized"
  | "forbidden"
  | "generic"
  | "file_type"
  | "file_too_large"
  | "file_empty"
  | "source_unreachable"
  | "source_unreadable"
  | "font_glyphs"
  | "brand_contrast"
  | "quota_exceeded"
  | "payments_unavailable"
  | "rate_limited";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
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
  font_glyphs: 422,
  brand_contrast: 422,
  quota_exceeded: 402,
  payments_unavailable: 503,
  rate_limited: 429,
};

export const fail = (code: ApiErrorCode, extra: Record<string, unknown> = {}) =>
  Response.json({ error: code, ...extra }, { status: STATUS[code] });

export const quotaFail = (reason: QuotaDenial) => fail("quota_exceeded", { reason });

/**
 * Authenticate, check the role for `route` (see rbac.ts ROUTES), run, and map known errors. A missing
 * route key means "any member" (only for read-only helpers that check their own rights).
 */
export async function guarded(
  route: RouteKey | ((v: Viewer) => Promise<Response>),
  maybeFn?: (v: Viewer) => Promise<Response>,
): Promise<Response> {
  const fn = typeof route === "function" ? route : maybeFn!;
  try {
    const v = await viewer();
    if (!v) return fail("unauthorized");
    if (typeof route === "string" && !can(v.role, ROUTES[route])) return fail("forbidden");
    return await fn(v);
  } catch (e) {
    if (e instanceof ProjectError) return fail(e.code);
    if (e instanceof QuotaError) return quotaFail(e.reason);
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
export const uuidParam = projectId;
