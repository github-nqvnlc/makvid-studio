"use client";
// Production progress of a project that is not ready yet: stage list, the live activity log, and a clear
// note when the project waits for the user or has failed. Shown inside the editor above everything else.
import { useState } from "react";
import { AlertTriangle, Hand, Wifi, WifiOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ActivityLog } from "./ActivityLog";
import { StageList } from "./StageList";
import { useProjectEvents, type StageKey } from "./useProjectEvents";

export function ProgressPanel({
  projectId,
  status,
  text,
  fraction,
}: {
  projectId: string;
  status: string;
  /** The one-line "now doing" sentence from the status stream. */
  text: string | null;
  fraction: number;
}) {
  const t = useTranslations("progress");
  const locale = useLocale();
  const { entries, stages, hasEarlier, loadEarlier, connection } = useProjectEvents(projectId, locale);
  const [stage, setStage] = useState<StageKey | null>(null);
  const failed = status === "failed" || status === "needs_attention";
  const waiting = status.startsWith("awaiting");
  const lastError = [...entries].reverse().find((e) => e.severity === "error");
  const running = stages.find((s) => s.state === "running");

  return (
    <section className="bg-card flex flex-col gap-4 rounded-lg border p-4" data-testid="progress" aria-label={t("title")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            connection === "live" ? "text-muted-foreground" : "text-foreground font-medium",
          )}
          data-testid="log-connection"
          data-connection={connection}
        >
          {connection === "live" ? (
            <Wifi className="size-3.5" aria-hidden />
          ) : (
            <WifiOff className="size-3.5" aria-hidden />
          )}
          {connection === "live" ? t("live") : t("reconnecting")}
        </span>
      </div>

      {!failed && !waiting && (
        <div className="flex flex-col gap-2">
          <strong className="text-sm" data-testid="progress-text">
            {text ?? t("working")}
          </strong>
          <Progress value={Math.round(fraction * 100)} aria-label={t("working")} />
        </div>
      )}
      {waiting && (
        <Alert data-testid="waiting-for-you">
          <Hand className="size-4" aria-hidden />
          <AlertTitle>{t("waitingTitle")}</AlertTitle>
          <AlertDescription>{t("waitingHelp")}</AlertDescription>
        </Alert>
      )}
      {failed && (
        <Alert className="border-destructive" data-testid="progress-failed">
          <AlertTriangle className="text-destructive size-4" aria-hidden />
          <AlertTitle>{status === "failed" ? t("failedTitle") : t("attentionTitle")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{lastError?.text ?? t("failedHelp")}</span>
            <Link href="/projects/new" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
              {t("startAgain")}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <StageList stages={stages} selected={stage} onSelect={setStage} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t("logTitle")}</h3>
            {stage && (
              <button type="button" className="text-primary text-xs underline" onClick={() => setStage(null)}>
                {t("all")}
              </button>
            )}
          </div>
          <ActivityLog entries={entries} stage={stage} hasEarlier={hasEarlier} onLoadEarlier={() => void loadEarlier()} />
        </div>
      </div>
      {/* Screen readers hear the stage changes, not every log line. */}
      <p className="sr-only" role="status" aria-live="polite" data-testid="stage-announce">
        {running ? t("announce", { stage: t(`stages.${running.stage}`) }) : ""}
      </p>
    </section>
  );
}
