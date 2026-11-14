"use client";
import { useEffect, useState } from "react";
import { LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { activeFilterCount, ASPECTS, SOURCES, STATUS_GROUP_KEYS, type UiFilters } from "@/lib/project-query";

export type ViewMode = "grid" | "table";
const ANY = "any";

function toggle(list: string[] | undefined, v: string): string[] {
  const s = new Set(list ?? []);
  if (s.has(v)) s.delete(v);
  else s.add(v);
  return [...s];
}

function DateFilter({
  label,
  preset,
  from,
  to,
  onChange,
}: {
  label: string;
  preset?: string;
  from?: string;
  to?: string;
  onChange: (v: { preset?: string; from?: string; to?: string }) => void;
}) {
  const t = useTranslations("projectsList.filters");
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={preset ?? ANY} onValueChange={(v) => onChange({ preset: v === ANY ? undefined : v })}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{t("any")}</SelectItem>
          <SelectItem value="today">{t("today")}</SelectItem>
          <SelectItem value="7d">{t("d7")}</SelectItem>
          <SelectItem value="30d">{t("d30")}</SelectItem>
          <SelectItem value="custom">{t("custom")}</SelectItem>
        </SelectContent>
      </Select>
      {preset === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" aria-label={t("from")} value={from ?? ""} max={to || undefined} onChange={(e) => onChange({ preset, from: e.target.value || undefined, to })} />
          <Input type="date" aria-label={t("to")} value={to ?? ""} min={from || undefined} onChange={(e) => onChange({ preset, from, to: e.target.value || undefined })} />
        </div>
      )}
    </div>
  );
}

export function ProjectsToolbar({
  filters,
  onChange,
  view,
  onView,
}: {
  filters: UiFilters;
  onChange: (next: UiFilters) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
}) {
  const t = useTranslations("projectsList");
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => {
    setText(filters.q ?? "");
  }, [filters.q]);
  // Search is debounced so typing does not fire one request per key.
  useEffect(() => {
    if (text === (filters.q ?? "")) return;
    const id = setTimeout(() => onChange({ ...filters, q: text.trim() || undefined, page: 1 }), 300);
    return () => clearTimeout(id);
  }, [text, filters, onChange]);

  const n = activeFilterCount(filters);
  const set = (patch: Partial<UiFilters>) => onChange({ ...filters, ...patch, page: 1 });
  const sortValue = `${filters.sort ?? "updated"}_${filters.dir ?? (filters.sort === "title" ? "asc" : "desc")}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          className="pl-9"
          data-testid="project-search"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="filters-button">
              <SlidersHorizontal className="size-4" aria-hidden />
              {t("filters.button")}
              {n > 0 && <Badge variant="secondary">{n}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[70vh] w-80 overflow-auto">
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{t("filters.status")}</legend>
                {STATUS_GROUP_KEYS.map((g) => (
                  <Label key={g} className="font-normal">
                    <Checkbox checked={filters.status?.includes(g) ?? false} onCheckedChange={() => set({ status: toggle(filters.status, g) })} />
                    {t(`filters.group.${g}`)}
                  </Label>
                ))}
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{t("filters.aspect")}</legend>
                <div className="flex flex-wrap gap-3">
                  {ASPECTS.map((a) => (
                    <Label key={a} className="font-normal">
                      <Checkbox checked={filters.aspect?.includes(a) ?? false} onCheckedChange={() => set({ aspect: toggle(filters.aspect, a) })} />
                      {a}
                    </Label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">{t("filters.source")}</legend>
                {SOURCES.map((s) => (
                  <Label key={s} className="font-normal">
                    <Checkbox checked={filters.source?.includes(s) ?? false} onCheckedChange={() => set({ source: toggle(filters.source, s) })} />
                    {t(`filters.sourceOpt.${s}`)}
                  </Label>
                ))}
              </fieldset>
              <div className="flex flex-col gap-2">
                <Label>{t("filters.mode")}</Label>
                <Select value={filters.mode ?? ANY} onValueChange={(v) => set({ mode: v === ANY ? undefined : v })}>
                  <SelectTrigger aria-label={t("filters.mode")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>{t("filters.any")}</SelectItem>
                    <SelectItem value="auto">{t("filters.modeOpt.auto")}</SelectItem>
                    <SelectItem value="review">{t("filters.modeOpt.review")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DateFilter
                label={t("filters.created")}
                preset={filters.created}
                from={filters.createdFrom}
                to={filters.createdTo}
                onChange={(v) => set({ created: v.preset, createdFrom: v.from, createdTo: v.to })}
              />
              <DateFilter
                label={t("filters.updated")}
                preset={filters.updated}
                from={filters.updatedFrom}
                to={filters.updatedTo}
                onChange={(v) => set({ updated: v.preset, updatedFrom: v.from, updatedTo: v.to })}
              />
              {n > 0 && (
                <Button variant="ghost" size="sm" onClick={() => onChange({ q: filters.q, sort: filters.sort, dir: filters.dir, pageSize: filters.pageSize })}>
                  <X className="size-4" aria-hidden />
                  {t("filters.clear")}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Select
          value={sortValue}
          onValueChange={(v) => {
            const [sort, dir] = v.split("_");
            set({ sort, dir });
          }}
        >
          <SelectTrigger aria-label={t("sort.label")} className="w-48" data-testid="sort-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["updated_desc", "updated_asc", "created_desc", "created_asc", "title_asc", "title_desc"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {t(`sort.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && onView(v as ViewMode)} variant="outline" aria-label={t("view.label")}>
          <ToggleGroupItem value="grid" aria-label={t("view.grid")}>
            <LayoutGrid className="size-4" aria-hidden />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label={t("view.table")}>
            <List className="size-4" aria-hidden />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
