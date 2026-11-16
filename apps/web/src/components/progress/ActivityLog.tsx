"use client";
// Live activity log: follows the newest line until the reader scrolls up, then offers "jump to latest".
// Only the newest MAX_DOM lines are in the page; older ones load on demand.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LogEntry, StageKey } from "./useProjectEvents";

const MAX_DOM = 1000;

export function ActivityLog({
  entries,
  stage,
  hasEarlier,
  onLoadEarlier,
}: {
  entries: LogEntry[];
  stage: StageKey | null;
  hasEarlier: boolean;
  onLoadEarlier: () => void;
}) {
  const t = useTranslations("progress");
  const locale = useLocale();
  const box = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);
  const shown = useMemo(
    () => (stage ? entries.filter((e) => e.stage === stage) : entries).slice(-MAX_DOM),
    [entries, stage],
  );
  const time = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    [locale],
  );

  useEffect(() => {
    const el = box.current;
    if (el && follow) el.scrollTop = el.scrollHeight;
  }, [shown, follow]);

  function onScroll() {
    const el = box.current;
    if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  }

  return (
    <div className="relative">
      <div
        ref={box}
        onScroll={onScroll}
        role="log"
        aria-live="off"
        aria-label={t("logTitle")}
        tabIndex={0}
        data-testid="activity-log"
        className="bg-card h-72 overflow-y-auto rounded-lg border p-3 text-sm"
      >
        {hasEarlier && !stage && (
          <Button type="button" variant="ghost" size="sm" className="mb-2" onClick={onLoadEarlier}>
            {t("loadEarlier")}
          </Button>
        )}
        {shown.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {shown.map((e) => (
              <li
                key={e.seq}
                data-testid="log-entry"
                data-kind={e.kind}
                className={cn(
                  "flex gap-3",
                  e.severity === "error" && "border-destructive border-l-2 pl-2 font-medium",
                )}
              >
                <time dateTime={e.at} className="text-muted-foreground shrink-0 font-mono text-xs leading-5">
                  {time.format(new Date(e.at))}
                </time>
                <span className="min-w-0 break-words">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!follow && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-3 bottom-3 shadow"
          data-testid="log-jump-latest"
          onClick={() => {
            setFollow(true);
            const el = box.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
        >
          <ArrowDown className="size-4" aria-hidden />
          {t("jumpLatest")}
        </Button>
      )}
    </div>
  );
}
