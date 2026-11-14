"use client";
import { Film, MoreHorizontal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatusBadge, type ProjectStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ProjectListItem } from "@/server/projects-list";

export interface ItemActions {
  canEdit: boolean;
  selected: Set<string>;
  onSelect: (id: string, on: boolean) => void;
  onRename: (p: ProjectListItem) => void;
  onDelete: (p: ProjectListItem) => void;
}

function RowMenu({ p, a }: { p: ProjectListItem; a: ItemActions }) {
  const t = useTranslations("projectsList.actions");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("label", { title: p.title })} data-testid={`actions-${p.id}`}>
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/projects/${p.id}`}>{t("open")}</Link>
        </DropdownMenuItem>
        {a.canEdit && (
          <>
            <DropdownMenuItem onSelect={() => a.onRename(p)} data-testid={`rename-${p.id}`}>
              {t("rename")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => a.onDelete(p)} data-testid={`delete-${p.id}`}>
              {t("delete")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SelectBox({ p, a }: { p: ProjectListItem; a: ItemActions }) {
  const t = useTranslations("projectsList.select");
  if (!a.canEdit) return null;
  return (
    <Checkbox
      checked={a.selected.has(p.id)}
      onCheckedChange={(v) => a.onSelect(p.id, v === true)}
      aria-label={t("one", { title: p.title })}
      data-testid={`select-${p.id}`}
    />
  );
}

function Processing({ p }: { p: ProjectListItem }) {
  const t = useTranslations("projectsList.progress");
  if (!p.progress) return null;
  return <Progress value={Math.round(p.progress.fraction * 100)} aria-label={t("label")} />;
}

export function ProjectGrid({ items, a }: { items: ProjectListItem[]; a: ItemActions }) {
  const f = useFormatter();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="project-list">
      {items.map((p) => (
        <li key={p.id} data-testid={`project-${p.id}`} className="bg-card flex flex-col overflow-hidden rounded-lg border">
          <Link href={`/projects/${p.id}`} className="bg-muted relative block aspect-video">
            {p.thumbnailUrl ? (
              <img src={p.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <span className="text-muted-foreground flex size-full items-center justify-center">
                <Film className="size-8" aria-hidden />
              </span>
            )}
          </Link>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-start gap-2">
              <SelectBox p={p} a={a} />
              <Link href={`/projects/${p.id}`} className="line-clamp-2 min-w-0 flex-1 font-medium hover:underline" title={p.title}>
                {p.title}
              </Link>
              <RowMenu p={p} a={a} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <StatusBadge status={p.status as ProjectStatus} />
              <span className="text-muted-foreground font-mono">{p.aspect}</span>
              <span className="text-muted-foreground">{f.relativeTime(new Date(p.updatedAt), new Date())}</span>
            </div>
            <Processing p={p} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectTable({ items, a, onSelectPage, allOnPage }: { items: ProjectListItem[]; a: ItemActions; onSelectPage: (on: boolean) => void; allOnPage: boolean }) {
  const t = useTranslations("projectsList");
  const f = useFormatter();
  return (
    <div className="rounded-lg border" data-testid="project-list">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0">
          <TableRow>
            {a.canEdit && (
              <TableHead className="w-10">
                <Checkbox checked={allOnPage} onCheckedChange={(v) => onSelectPage(v === true)} aria-label={t("select.page")} data-testid="select-page" />
              </TableHead>
            )}
            <TableHead>{t("columns.title")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("columns.aspect")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("columns.creator")}</TableHead>
            <TableHead className="hidden sm:table-cell">{t("columns.updated")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((p) => (
            <TableRow key={p.id} data-testid={`project-${p.id}`}>
              {a.canEdit && (
                <TableCell>
                  <SelectBox p={p} a={a} />
                </TableCell>
              )}
              <TableCell className="max-w-64">
                <Link href={`/projects/${p.id}`} className="line-clamp-2 font-medium hover:underline" title={p.title}>
                  {p.title}
                </Link>
                <Processing p={p} />
              </TableCell>
              <TableCell>
                <StatusBadge status={p.status as ProjectStatus} />
              </TableCell>
              <TableCell className="hidden font-mono sm:table-cell">{p.aspect}</TableCell>
              <TableCell className="text-muted-foreground hidden md:table-cell">{p.createdBy?.name ?? ""}</TableCell>
              <TableCell className="text-muted-foreground hidden sm:table-cell">{f.relativeTime(new Date(p.updatedAt), new Date())}</TableCell>
              <TableCell>
                <RowMenu p={p} a={a} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
