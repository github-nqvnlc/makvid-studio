"use client";
// Batch progress: status per row (polled), retry failed rows, cancel/resume, ZIP download.
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BatchView } from "@makvid/pipeline";
import { PageHeader } from "@/components/common/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { apiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto flex max-w-4xl flex-col gap-4" data-testid="batch-progress">
      <PageHeader
        title={view.batch.name}
        actions={
          <Badge variant="secondary" data-testid="batch-status">
            {t(`status.${view.batch.status}` as "status.running")}
          </Badge>
        }
      />
      <Progress value={Math.round((done / Math.max(1, view.batch.total)) * 100)} aria-label={t("progress", { done, total: view.batch.total })} />
      <p className="text-muted-foreground text-sm">
        {t("progress", { done: c.succeeded, total: view.batch.total })}
        {c.failed > 0 && ` · ${t("item.failed")}: ${c.failed}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {view.batch.zip && (
          <a className={cn(buttonVariants(), "gap-1.5")} href={view.batch.zip} download data-testid="batch-zip">
            <Download className="size-4" aria-hidden />
            {t("zip")}
          </a>
        )}
        {zipPending && <span className="text-muted-foreground text-sm">{t("zipPending")}</span>}
        {canRun && c.failed > 0 && FINAL.has(view.batch.status) && view.batch.status !== "cancelled" && (
          <Button variant="outline" disabled={busy} onClick={() => void act("retry")} data-testid="batch-retry">
            {t("retry", { n: c.failed })}
          </Button>
        )}
        {canRun && view.batch.status === "paused_quota" && (
          <Button variant="outline" disabled={busy} onClick={() => void act("resume")}>
            {t("resume")}
          </Button>
        )}
        {canRun && !final && (
          <Button variant="outline" disabled={busy} onClick={() => void act("cancel")}>
            {t("cancel")}
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-lg border">
        <Table data-testid="batch-rows">
          <TableHeader>
            <TableRow>
              <TableHead>{t("row")}</TableHead>
              <TableHead>{t("values")}</TableHead>
              <TableHead>{t("state")}</TableHead>
              <TableHead>{t("video")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.items.map((i) => (
              <TableRow key={i.row} data-status={i.status}>
                <TableCell>{i.row}</TableCell>
                <TableCell className="text-sm">{Object.values(i.variables).join(" · ")}</TableCell>
                <TableCell>{t(`item.${i.status}` as "item.running")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {i.video && (
                      <a href={i.video} download className="underline underline-offset-4">
                        {"MP4"}
                      </a>
                    )}
                    {i.projectId && (
                      <Link href={`/projects/${i.projectId}`} className="underline underline-offset-4">
                        {t("open")}
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
