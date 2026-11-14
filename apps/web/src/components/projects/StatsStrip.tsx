"use client";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

export type Stats = { all: number; processing: number; ready: number; attention: number; failed: number };

export function StatsStrip({ stats }: { stats: Stats | null }) {
  const t = useTranslations("projectsList.stats");
  const keys = ["all", "processing", "ready", "attention", "failed"] as const;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="stats-strip">
      {keys.map((k) => (
        <div key={k} className="bg-card rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">{t(k)}</dt>
          <dd className="text-2xl font-semibold">{stats ? stats[k] : <Skeleton className="mt-1 h-7 w-10" />}</dd>
        </div>
      ))}
    </dl>
  );
}
