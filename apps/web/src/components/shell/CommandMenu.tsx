"use client";
import { useEffect, useState } from "react";
import { Languages, Moon, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "./nav-items";

interface Hit {
  id: string;
  title: string;
}

/** Ctrl/Cmd+K: pages (by role), matching projects (debounced 200 ms), and a few actions. */
export function CommandMenu({ allowed }: { allowed: string[] }) {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects?q=${encodeURIComponent(q.trim())}&pageSize=8`, { signal: ctl.signal });
        if (!res.ok) return;
        const body = (await res.json()) as { projects: Array<{ id: string; title: string }> };
        setHits(body.projects.slice(0, 8));
      } catch {
        /* aborted or offline: keep the pages list */
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q, open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href as "/");
  };
  const label = (l: string) => (l.startsWith("shell:") ? t(l.slice(6) as "profile") : tn(l as "projects"));

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={t("search.button")} data-testid="open-palette" className="gap-2">
        <Search className="size-4" aria-hidden />
        <span className="text-muted-foreground hidden lg:inline">{t("search.button")}</span>
        <kbd className="bg-muted text-muted-foreground hidden rounded border px-1.5 font-mono text-[10px] lg:inline">{"Ctrl K"}</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title={t("search.title")} description={t("search.placeholder")}>
        <CommandInput value={q} onValueChange={setQ} placeholder={t("search.placeholder")} />
        <CommandList>
          <CommandEmpty>{t("search.empty")}</CommandEmpty>
          <CommandGroup heading={t("search.pages")}>
            {NAV_ITEMS.filter((i) => allowed.includes(i.id)).map((i) => (
              <CommandItem key={i.id} value={`page ${label(i.label)}`} onSelect={() => go(i.href)}>
                <i.icon className="size-4" aria-hidden />
                {label(i.label)}
              </CommandItem>
            ))}
          </CommandGroup>
          {hits.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t("search.projects")}>
                {hits.map((h) => (
                  <CommandItem key={h.id} value={`project ${h.title} ${h.id}`} onSelect={() => go(`/projects/${h.id}`)}>
                    {h.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          <CommandSeparator />
          <CommandGroup heading={t("search.actions")}>
            {allowed.includes("new") && (
              <CommandItem value="action new video" onSelect={() => go("/projects/new")}>
                <Plus className="size-4" aria-hidden />
                {t("search.newVideo")}
              </CommandItem>
            )}
            <CommandItem
              value="action theme"
              onSelect={() => {
                setTheme(theme === "dark" ? "light" : "dark");
                setOpen(false);
              }}
            >
              <Moon className="size-4" aria-hidden />
              {t("search.switchTheme")}
            </CommandItem>
            <CommandItem
              value="action language"
              onSelect={() => {
                setOpen(false);
                router.replace(pathname as "/", { locale: locale === "vi" ? "en" : "vi" });
              }}
            >
              <Languages className="size-4" aria-hidden />
              {t("search.switchLanguage")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
