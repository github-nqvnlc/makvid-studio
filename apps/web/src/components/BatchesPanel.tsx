"use client";
// Batch creation (US5, T133): pick a template, upload a CSV, see problems before running, then start.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { apiError, type ErrorKey } from "@/lib/api-client";

export interface TemplateItem {
  id: string;
  name: string;
  variables: Array<{ name: string; maxLength: number }>;
}
export interface BatchItem {
  id: string;
  name: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  createdAt: string;
}
interface Check {
  rows: number;
  missingColumns: string[];
  extraColumns: string[];
  issues: Array<{
    row: number;
    column: string;
    code: "required" | "too_long" | "not_a_number";
    maxLength?: number;
  }>;
  tooManyRows: boolean;
  preview: Array<Record<string, string>>;
}

export function BatchesPanel({
  templates,
  batches,
  maxConcurrency,
  initialTemplate,
}: {
  templates: TemplateItem[];
  batches: BatchItem[];
  maxConcurrency: number;
  initialTemplate?: string;
}) {
  const t = useTranslations("batches");
  const te = useTranslations("errors");
  const tq = useTranslations("quota");
  const router = useRouter();
  const [templateId, setTemplateId] = useState(initialTemplate ?? templates[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [concurrency, setConcurrency] = useState(Math.min(2, maxConcurrency));
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tpl = templates.find((x) => x.id === templateId);

  const form = () => {
    const f = new FormData();
    f.set("templateId", templateId);
    if (file) f.set("file", file);
    f.set("name", name);
    f.set("concurrency", String(concurrency));
    return f;
  };
  const fail = async (res: Response) => {
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as { reason?: string } | null;
    const code: ErrorKey = await apiError(res);
    setError(code === "quota_exceeded" && body?.reason ? tq(body.reason as "videos") : te(code));
  };

  async function runCheck() {
    if (!file || !templateId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/batches/check", { method: "POST", body: form() });
    setBusy(false);
    if (!res.ok) return fail(res);
    setCheck((await res.json()) as Check);
  }

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/batches", { method: "POST", body: form() });
    setBusy(false);
    if (res.status === 400) {
      const b = (await res.json()) as Partial<Check>;
      if (b.issues || b.missingColumns) return setCheck((c) => ({ ...(c as Check), ...b }));
    }
    if (!res.ok) return fail(res);
    const { id } = (await res.json()) as { id: string };
    router.push(`/batches/${id}`);
  }

  const valid =
    check && !check.missingColumns.length && !check.issues.length && !check.tooManyRows && check.rows > 0;
  return (
    <div className="stack">
      <h1>{t("title")}</h1>
      <p className="muted">{t("intro")}</p>
      <section className="card stack" data-testid="batch-form">
        <h2>{t("new")}</h2>
        {!templates.length ? (
          <p className="muted">{t("noTemplates")}</p>
        ) : (
          <>
            <label className="stack">
              {t("template")}
              <select value={templateId} onChange={(e) => (setTemplateId(e.target.value), setCheck(null))}>
                {templates.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            {tpl && (
              <p className="small muted">
                {t("variables", { vars: tpl.variables.map((v) => v.name).join(", ") })}
              </p>
            )}
            <label className="stack">
              {t("file")}
              <input
                type="file"
                accept=".csv,text/csv"
                data-testid="batch-file"
                onChange={(e) => (setFile(e.target.files?.[0] ?? null), setCheck(null))}
              />
            </label>
            <label className="stack">
              {t("name")}
              <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="stack">
              {t("concurrency")}
              <input
                type="number"
                min={1}
                max={maxConcurrency}
                value={concurrency}
                onChange={(e) =>
                  setConcurrency(Math.max(1, Math.min(maxConcurrency, Number(e.target.value) || 1)))
                }
              />
            </label>
            <div className="row">
              <button className="btn" disabled={!file || busy} onClick={() => void runCheck()}>
                {t("check")}
              </button>
              {valid && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void start()}
                  data-testid="batch-start"
                >
                  {t("start", { n: check.rows })}
                </button>
              )}
            </div>
            {check && (
              <div className="stack" data-testid="batch-check">
                {check.missingColumns.length > 0 && (
                  <p className="error">{t("missing", { cols: check.missingColumns.join(", ") })}</p>
                )}
                {check.tooManyRows && <p className="error">{t("tooMany")}</p>}
                {check.issues.slice(0, 20).map((i) => (
                  <p key={`${i.row}-${i.column}`} className="error small">
                    {t(`issue_${i.code}`, { row: i.row, column: i.column, max: i.maxLength ?? 0 })}
                  </p>
                ))}
                {valid && <p>{t("rowsOk", { n: check.rows })}</p>}
                {check.extraColumns.length > 0 && (
                  <p className="small muted">{t("extra", { cols: check.extraColumns.join(", ") })}</p>
                )}
              </div>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="card stack">
        <h2>{t("list")}</h2>
        {!batches.length ? (
          <p className="muted">{t("empty")}</p>
        ) : (
          <ul className="list">
            {batches.map((b) => (
              <li key={b.id} className="row">
                <Link href={`/batches/${b.id}`}>{b.name}</Link>
                <span className="badge">{t(`status.${b.status}` as "status.running")}</span>
                <span className="small muted">{t("progress", { done: b.succeeded, total: b.total })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
