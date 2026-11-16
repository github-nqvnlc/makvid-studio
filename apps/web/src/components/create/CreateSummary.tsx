"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Usage {
  plan: { limits: { videos: number | null; max_video_seconds: number } };
  used: Record<string, number>;
  reserved: Record<string, number>;
}

/** Sticky summary of every choice, the quota check and the start button. */
export function CreateSummary({
  typeName,
  preview,
  duration,
  aspect,
  mode,
  voice,
  brand,
  busy,
  disabledReason,
}: {
  typeName: string;
  /** Short view of the content: the idea or script text, the link or the file name. */
  preview: string;
  /** Length in seconds, or null while the field is invalid. */
  duration: number | null;
  aspect: string;
  mode: string;
  voice: string;
  /** Whether the brand kit is applied; null when the workspace has none. */
  brand: boolean | null;
  busy: boolean;
  /** Why Start is disabled for a reason other than quota (shown under the button). */
  disabledReason: string | null;
}) {
  const t = useTranslations("create");
  const [usage, setUsage] = useState<Usage | null | "error">(null);
  useEffect(() => {
    let live = true;
    fetch("/api/workspace/usage")
      .then((r) => (r.ok ? (r.json() as Promise<Usage>) : Promise.reject(new Error("usage"))))
      .then((u) => live && setUsage(u))
      .catch(() => live && setUsage("error"));
    return () => {
      live = false;
    };
  }, []);

  const u = usage && usage !== "error" ? usage : null;
  const limit = u?.plan.limits.videos ?? null;
  const left = u && limit !== null ? limit - (u.used.videos ?? 0) - (u.reserved.videos ?? 0) : null;
  const max = u?.plan.limits.max_video_seconds ?? null;
  const blocked: "videos" | "duration" | null =
    left !== null && left <= 0 ? "videos" : max !== null && duration !== null && duration > max ? "duration" : null;
  const short = preview.length > 140 ? `${preview.slice(0, 140)}…` : preview;

  return (
    <Card className="lg:sticky lg:top-20" data-testid="create-summary">
      <CardHeader>
        <CardTitle className="text-base">{t("summary.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted-foreground">{t("summary.content")}</dt>
          <dd className="min-w-0">
            <span className="block font-medium">{typeName}</span>
            <span className="text-muted-foreground block break-words" data-testid="summary-preview">
              {short || t("summary.empty")}
            </span>
          </dd>
          <dt className="text-muted-foreground">{t("summary.aspect")}</dt>
          <dd className="font-mono">{aspect}</dd>
          <dt className="text-muted-foreground">{t("summary.duration")}</dt>
          <dd>{duration === null ? "–" : t("summary.seconds", { n: duration })}</dd>
          <dt className="text-muted-foreground">{t("summary.mode")}</dt>
          <dd>{mode}</dd>
          <dt className="text-muted-foreground">{t("summary.voice")}</dt>
          <dd className="truncate">{voice || "–"}</dd>
          {brand !== null && (
            <>
              <dt className="text-muted-foreground">{t("summary.brand")}</dt>
              <dd>{brand ? t("summary.brandOn") : t("summary.brandOff")}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("summary.videosLeft")}</dt>
          <dd data-testid="videos-left">
            {usage === "error" ? "–" : left === null ? (u ? t("summary.unlimited") : "…") : left}
          </dd>
        </dl>
        {usage === "error" && (
          <Alert>
            <AlertDescription>{t("summary.loadFailed")}</AlertDescription>
          </Alert>
        )}
        {blocked && (
          <Alert variant="destructive" data-testid="quota-block">
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {blocked === "videos" ? t("summary.overLimit") : t("summary.overDuration", { n: max ?? 0 })}
              </span>
              <Link
                href="/workspace/billing"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
              >
                {t("summary.upgrade")}
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={busy || blocked !== null || disabledReason !== null}
          data-testid="create-submit"
        >
          {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
          {busy ? t("submitting") : t("composer.start")}
        </Button>
        {disabledReason && !blocked && (
          <p className="text-muted-foreground text-xs" data-testid="start-disabled-reason">
            {disabledReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
