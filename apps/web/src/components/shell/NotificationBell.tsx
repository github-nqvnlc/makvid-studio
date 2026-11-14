"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { readPref, writePref } from "@/lib/prefs";

interface Item {
  id: string;
  title: string;
  status: "ready" | "needs_attention" | "failed";
  updatedAt: string;
}

const KEY = "mkv.notif.seen";
const WATCH = new Set(["ready", "needs_attention", "failed"]);

/** Ready / needs-attention / failed projects since the last "seen" time (kept in this browser). */
export function NotificationBell() {
  const t = useTranslations("shell.notifications");
  const ts = useTranslations("shell");
  const f = useFormatter();
  const [items, setItems] = useState<Item[]>([]);
  const [seen, setSeen] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects?status=ready,needs_attention,failed&sort=updated&dir=desc&pageSize=10");
      if (!res.ok) return;
      const body = (await res.json()) as { projects: Array<{ id: string; title: string; status: string; updatedAt: string }> };
      setItems(body.projects.filter((p) => WATCH.has(p.status)).slice(0, 10) as Item[]);
    } catch {
      /* offline: keep what we have */
    }
  }, []);

  useEffect(() => {
    setSeen(readPref<number>(KEY, Date.now() - 86_400_000));
    void load();
    const timer = setInterval(() => void load(), 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const unread = items.filter((i) => new Date(i.updatedAt).getTime() > seen);
  function markSeen() {
    const now = Date.now();
    setSeen(now);
    writePref(KEY, now);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          aria-label={unread.length ? `${t("button")} (${t("unread", { n: unread.length })})` : t("button")}
          data-testid="notification-bell"
        >
          <Bell className="size-4" aria-hidden />
          {unread.length > 0 && (
            <span className="bg-destructive text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px]">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{t("title")}</span>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markSeen}>
              {t("markSeen")}
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">{t("empty")}</p>
        ) : (
          <ul className="max-h-80 overflow-auto">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={`/projects/${i.id}`} className="hover:bg-accent flex flex-col gap-0.5 px-3 py-2 text-sm" onClick={markSeen}>
                  <span className="truncate font-medium">{i.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {t(i.status)} · {f.relativeTime(new Date(i.updatedAt), new Date())}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <span className="sr-only">{ts("loadError")}</span>
      </PopoverContent>
    </Popover>
  );
}
