"use client";
// The signed-in home: stats, search, filters (kept in the URL), grid/table, rename, delete one / many / all matching.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film, SearchX, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiError } from "@/lib/api-client";
import { PAGE_SIZES, activeFilterCount, fromSearchParams, toSearchParams, type UiFilters } from "@/lib/project-query";
import { readPref, writePref } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import type { ProjectListResult, ProjectListItem } from "@/server/projects-list";
import { DeleteDialog, type DeleteTarget } from "./DeleteDialogs";
import { ProjectGrid, ProjectTable } from "./ProjectItems";
import { ProjectsToolbar, type ViewMode } from "./ProjectsToolbar";
import { RenameDialog } from "./RenameDialog";
import { StatsStrip, type Stats } from "./StatsStrip";

const VIEW_KEY = "mkv.projects.view";
const POLL_MS = 5000;

async function count(qs: string): Promise<number> {
  const res = await fetch(`/api/projects?${qs}&pageSize=1`);
  if (!res.ok) throw new Error("stats");
  return ((await res.json()) as ProjectListResult).total;
}

/** Filter -> body of POST /api/projects/delete (csv strings like the query string; no paging or sort). */
function filterBody(f: UiFilters) {
  const csv = (v?: string[]) => (v?.length ? v.join(",") : undefined);
  return {
    q: f.q,
    status: csv(f.status),
    aspect: csv(f.aspect),
    source: csv(f.source),
    mode: f.mode,
    createdBy: f.createdBy,
    created: f.created,
    updated: f.updated,
    createdFrom: f.createdFrom,
    createdTo: f.createdTo,
    updatedFrom: f.updatedFrom,
    updatedTo: f.updatedTo,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function ProjectsView({ canEdit, canCreate }: { canEdit: boolean; canCreate: boolean }) {
  const t = useTranslations("projectsList");
  const te = useTranslations("errors");
  const tn = useTranslations("nav");
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const filters = useMemo(() => fromSearchParams(new URLSearchParams(sp.toString())), [sp]);
  const key = toSearchParams(filters).toString();

  const [data, setData] = useState<ProjectListResult | null>(null);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    setView(readPref<ViewMode>(VIEW_KEY, "grid"));
  }, []);

  const setFilters = useCallback(
    (next: UiFilters) => {
      const query = Object.fromEntries(toSearchParams(next).entries());
      router.replace({ pathname, query } as Parameters<typeof router.replace>[0]);
    },
    [router, pathname],
  );

  const load = useCallback(
    async (silent = false) => {
      const mine = ++seq.current;
      if (!silent) setError(false);
      try {
        const res = await fetch(`/api/projects?${key}`);
        if (!res.ok) throw new Error(await apiError(res));
        const body = (await res.json()) as ProjectListResult;
        if (mine === seq.current) setData(body);
      } catch {
        if (mine === seq.current && !silent) setError(true);
      }
    },
    [key],
  );

  const loadStats = useCallback(async () => {
    try {
      const [all, processing, ready, attention, failed] = await Promise.all([
        count(""),
        count("status=processing"),
        count("status=ready"),
        count("status=attention"),
        count("status=failed"),
      ]);
      setStats({ all, processing, ready, attention, failed });
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
    void load();
  }, [load]);
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // Processing rows refresh every 5 s while the tab is visible.
  const anyProcessing = data?.projects.some((p) => p.progress) ?? false;
  useEffect(() => {
    if (!anyProcessing) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [anyProcessing, load]);

  const items = data?.projects ?? [];
  const allOnPage = items.length > 0 && items.every((p) => selected.has(p.id));
  const count_ = allMatching ? (data?.total ?? 0) : selected.size;
  const filtered = activeFilterCount(filters) > 0 || !!filters.q;

  function onSelect(id: string, on: boolean) {
    setAllMatching(false);
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }
  function onSelectPage(on: boolean) {
    setAllMatching(false);
    setSelected(on ? new Set(items.map((p) => p.id)) : new Set());
  }
  function changeView(v: ViewMode) {
    setView(v);
    writePref(VIEW_KEY, v);
  }

  async function rename(id: string, title: string) {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      toast.error(te(await apiError(res)));
      return;
    }
    setData((d) => d && { ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, title } : p)) });
    setRenaming(null);
    toast.success(t("rename.saved"));
  }

  async function confirmDelete(target: DeleteTarget) {
    let deleted = 0;
    let failed = 0;
    if (target.kind === "one") {
      const res = await fetch(`/api/projects/${target.id}`, { method: "DELETE" });
      if (res.status === 404) {
        toast.info(t("delete.alreadyGone"));
      } else if (!res.ok) {
        toast.error(t("delete.failed"));
        return;
      } else deleted = 1;
    } else {
      const body = target.kind === "many" ? { ids: [...selected] } : { filter: filterBody(filters), confirm: t("delete.phrase") };
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(t("delete.failed"));
        return;
      }
      ({ deleted, failed } = (await res.json()) as { deleted: number; failed: number });
    }
    setDeleting(null);
    setSelected(new Set());
    setAllMatching(false);
    if (deleted || failed)
      (failed ? toast.warning : toast.success)(failed ? t("delete.partial", { n: deleted, f: failed }) : t("delete.deleted", { n: deleted }));
    // Back one page when the last page just emptied.
    const left = (data?.total ?? 0) - deleted;
    const pageSize = filters.pageSize ?? 24;
    if ((filters.page ?? 1) > 1 && left <= ((filters.page ?? 1) - 1) * pageSize) setFilters({ ...filters, page: Math.max(1, Math.ceil(left / pageSize)) });
    else void load();
    void loadStats();
  }

  const actions = { canEdit, selected, onSelect, onRename: (p: ProjectListItem) => setRenaming({ id: p.id, title: p.title }), onDelete: (p: ProjectListItem) => setDeleting({ kind: "one", id: p.id, title: p.title }) };
  const pageSize = data?.pageSize ?? filters.pageSize ?? 24;
  const page = data?.page ?? filters.page ?? 1;
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const newButton = canCreate && (
    <Link href="/projects/new" className={cn(buttonVariants())}>
      {tn("newProject")}
    </Link>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} actions={newButton} />
      <StatsStrip stats={stats} />
      <ProjectsToolbar filters={filters} onChange={setFilters} view={view} onView={changeView} />

      {canEdit && count_ > 0 && (
        <div className="bg-accent text-accent-foreground flex flex-wrap items-center gap-3 rounded-lg px-4 py-2 text-sm" role="status" data-testid="selection-bar">
          <span className="font-medium">{t("select.count", { n: count_ })}</span>
          {!allMatching && allOnPage && total > items.length && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setAllMatching(true)} data-testid="select-all-matching">
              {t("select.all", { n: total })}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onSelectPage(false)}>
            {t("select.clear")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="ml-auto gap-1.5"
            data-testid="delete-selected"
            onClick={() => setDeleting(allMatching ? { kind: "all", n: total } : { kind: "many", n: selected.size })}
          >
            <Trash2 className="size-4" aria-hidden />
            {t("select.deleteSelected")}
          </Button>
        </div>
      )}

      {error ? (
        <ErrorState message={t("loadFailed")} onRetry={() => void load()} />
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title={t("noResults.title")}
            description={t("noResults.body")}
            action={<Button variant="outline" onClick={() => setFilters({})}>{t("noResults.clear")}</Button>}
          />
        ) : (
          <EmptyState
            icon={Film}
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              canCreate ? (
                <Link href="/projects/new" className={cn(buttonVariants())}>
                  {t("empty.cta")}
                </Link>
              ) : undefined
            }
          />
        )
      ) : view === "grid" ? (
        <ProjectGrid items={items} a={actions} />
      ) : (
        <ProjectTable items={items} a={actions} onSelectPage={onSelectPage} allOnPage={allOnPage} />
      )}

      {data && total > 0 && (
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm" aria-label={t("pager.info", { from, to, total })}>
          <span className="text-muted-foreground" data-testid="pager-info">
            {t("pager.info", { from, to, total })}
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => setFilters({ ...filters, pageSize: Number(v), page: 1 })}>
              <SelectTrigger aria-label={t("pager.size")} className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" disabled={page <= 1} aria-label={t("pager.prev")} onClick={() => setFilters({ ...filters, page: page - 1 })}>
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <Button variant="outline" size="icon" disabled={to >= total} aria-label={t("pager.next")} onClick={() => setFilters({ ...filters, page: page + 1 })} data-testid="pager-next">
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </nav>
      )}

      <RenameDialog project={renaming} onClose={() => setRenaming(null)} onSave={rename} />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} />
    </div>
  );
}
