"use client";
// Batch progress (US5, T133): status per row (polled), retry failed rows, cancel/resume, ZIP download.
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { BatchView } from "@makvid/pipeline";
import { Link } from "@/i18n/navigation";
import { apiError } from "@/lib/api-client";

const FINAL = new Set(["completed", "completed_with_errors", "cancelled"]);

export function BatchProgress({ initial, canRun }: { initial: BatchView; canRun: boolean }) {
  const t = useTranslations("batches");
  const te = useTranslations("errors");
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/batches/${initial.batch.id}`, { cache: "no-store" });
    if (res.ok) setView((await res.json()) as BatchView);
  }, [initial.batch.id]);

  const final = FINAL.has(view.batch.status);
  const zipPending = final && view.batch.counts.succeeded > 0 && !view.batch.zip;
  useEffect(() => {
    if (final && !zipPending) return;
    const id = setInterval(() => void refresh(), 2000);
    return () => clearInterval(id);
  }, [final, zipPending, refresh]);

  async function act(path: "retry" | "cancel" | "resume") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/batches/${view.batch.id}/${path}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) return setError(te(await apiError(res)));
    await refresh();
  }

  const c = view.batch.counts;
  const done = c.succeeded + c.failed + c.cancelled;
  return (
    <div className="stack" data-testid="batch-progress">
      <div className="row">
        <h1>{view.batch.name}</h1>
        <span className="badge" data-testid="batch-status">
          {t(`status.${view.batch.status}` as "status.running")}
        </span>
      </div>
      <div className="progress" aria-label={t("progress", { done, total: view.batch.total })}>
        <div style={{ width: `${Math.round((done / Math.max(1, view.batch.total)) * 100)}%` }} />
      </div>
      <p className="small muted">
        {t("progress", { done: c.succeeded, total: view.batch.total })}
        {c.failed > 0 && ` · ${t("item.failed")}: ${c.failed}`}
      </p>
      <div className="row">
        {view.batch.zip && (
          <a className="btn primary" href={view.batch.zip} download data-testid="batch-zip">
            {t("zip")}
          </a>
        )}
        {zipPending && <span className="small muted">{t("zipPending")}</span>}
        {canRun && c.failed > 0 && FINAL.has(view.batch.status) && view.batch.status !== "cancelled" && (
          <button className="btn" disabled={busy} onClick={() => void act("retry")} data-testid="batch-retry">
            {t("retry", { n: c.failed })}
          </button>
        )}
        {canRun && view.batch.status === "paused_quota" && (
          <button className="btn" disabled={busy} onClick={() => void act("resume")}>
            {t("resume")}
          </button>
        )}
        {canRun && !final && (
          <button className="btn" disabled={busy} onClick={() => void act("cancel")}>
            {t("cancel")}
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <table className="card" data-testid="batch-rows">
        <thead>
          <tr>
            <th>{t("row")}</th>
            <th>{t("values")}</th>
            <th>{t("state")}</th>
            <th>{t("video")}</th>
          </tr>
        </thead>
        <tbody>
          {view.items.map((i) => (
            <tr key={i.row} data-status={i.status}>
              <td>{i.row}</td>
              <td className="small">{Object.values(i.variables).join(" · ")}</td>
              <td>{t(`item.${i.status}` as "item.running")}</td>
              <td className="row">
                {i.video && (
                  <a href={i.video} download>
                    MP4
                  </a>
                )}
                {i.projectId && <Link href={`/projects/${i.projectId}`}>{t("open")}</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
