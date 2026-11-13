// Client helpers: API errors are codes; the UI shows errors.<code> (never raw server text).
const CODES = [
  "busy",
  "conflict",
  "invalid",
  "not_found",
  "nothing_to_undo",
  "nothing_to_redo",
  "unauthorized",
  "generic",
  "file_type",
  "file_too_large",
  "file_empty",
  "source_unreachable",
  "source_unreadable",
  "font_glyphs",
  "brand_contrast",
  "forbidden",
  "quota_exceeded",
  "payments_unavailable",
  "rate_limited",
] as const;
export type ErrorKey = (typeof CODES)[number];

export async function apiError(res: Response): Promise<ErrorKey> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  const code = body?.error;
  return (CODES as readonly string[]).includes(code ?? "") ? (code as ErrorKey) : "generic";
}

/** Quota denial reason sent with quota_exceeded (402), if any. */
export async function quotaReason(res: Response): Promise<string | null> {
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { reason?: string } | null;
  return body?.reason ?? null;
}

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: ErrorKey }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: await apiError(res) };
  return { ok: true, data: (await res.json()) as T };
}
