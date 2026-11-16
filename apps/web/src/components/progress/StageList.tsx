"use client";
// The production stages in order with their state; selecting one filters the log below.
import { AlertTriangle, Check, Circle, Hand, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { StageInfo, StageKey, StageState } from "./useProjectEvents";

const ICON: Record<StageState, React.ReactNode> = {
  waiting: <Circle className="text-muted-foreground size-4" aria-hidden />,
  running: <Loader2 className="text-primary size-4 motion-safe:animate-spin" aria-hidden />,
  needs_approval: <Hand className="text-primary size-4" aria-hidden />,
  done: <Check className="text-primary size-4" aria-hidden />,
  failed: <AlertTriangle className="text-destructive size-4" aria-hidden />,
};

export function StageList({
  stages,
  selected,
  onSelect,
}: {
  stages: StageInfo[];
  selected: StageKey | null;
  onSelect: (s: StageKey | null) => void;
}) {
  const t = useTranslations("progress");
  return (
    <ol className="flex flex-wrap gap-2 md:flex-col" aria-label={t("stagesLabel")}>
      {stages.map(({ stage, state }) => (
        <li key={stage}>
          <button
            type="button"
            data-testid={`stage-${stage}`}
            data-state={state}
            aria-pressed={selected === stage}
            onClick={() => onSelect(selected === stage ? null : stage)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              selected === stage ? "border-primary ring-primary ring-1" : "hover:bg-muted",
              state === "running" && "bg-muted/60",
            )}
          >
            {ICON[state]}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-medium">{t(`stages.${stage}`)}</span>
              <span className="text-muted-foreground text-xs">{t(`states.${state}`)}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
