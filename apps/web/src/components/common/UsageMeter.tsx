"use client";
import { AlertTriangle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Progress } from "@/components/ui/progress";

/** Label, "used / limit unit", progress bar; warning at >= 80 %, "Unlimited" when limit is null. */
export function UsageMeter({ label, used, limit, unit }: { label: string; used: number; limit: number | null; unit?: string }) {
  const t = useTranslations("common");
  const f = useFormatter();
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const warn = limit !== null && limit > 0 && pct >= 80;
  return (
    <div className="flex flex-col gap-1.5" data-testid="usage-meter">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={warn ? "text-destructive flex items-center gap-1" : "text-muted-foreground"}>
          {warn && <AlertTriangle className="size-3.5" aria-hidden />}
          {f.number(used)} / {limit === null ? t("unlimited") : f.number(limit)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      {limit !== null && <Progress value={pct} aria-label={label} />}
    </div>
  );
}
