"use client";
import { useState } from "react";
import { Check, Copy, Pencil, Redo2, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusBadge, type ProjectStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Title with inline rename, status, undo / redo and duplicate. */
export function EditorToolbar({
  title,
  status,
  settled,
  canUndo,
  canRedo,
  onRename,
  onAction,
}: {
  title: string;
  status: string;
  settled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onRename: (title: string) => Promise<boolean>;
  onAction: (action: "undo" | "redo" | "duplicate") => void;
}) {
  const t = useTranslations("editor");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v || v === title) return setEditing(false);
    if (await onRename(v)) setEditing(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {editing ? (
        <form onSubmit={save} className="flex min-w-0 flex-1 items-center gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label={t("renameLabel")} maxLength={200} autoFocus className="max-w-md" data-testid="title-input" />
          <Button type="submit" size="icon" variant="outline" aria-label={t("renameSave")}>
            <Check className="size-4" aria-hidden />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label={t("renameCancel")} onClick={() => setEditing(false)}>
            <X className="size-4" aria-hidden />
          </Button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-xl font-semibold" data-testid="project-title" title={title}>
            {title}
          </h1>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("rename")}
            onClick={() => {
              setValue(title);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        </div>
      )}
      <span data-testid="project-status">
        <StatusBadge status={status as ProjectStatus} />
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!settled || !canUndo} onClick={() => onAction("undo")} className="gap-1.5">
          <Undo2 className="size-4" aria-hidden />
          {t("undo")}
        </Button>
        <Button variant="outline" size="sm" disabled={!settled || !canRedo} onClick={() => onAction("redo")} className="gap-1.5">
          <Redo2 className="size-4" aria-hidden />
          {t("redo")}
        </Button>
        <Button variant="outline" size="sm" disabled={!settled} onClick={() => onAction("duplicate")} className="gap-1.5">
          <Copy className="size-4" aria-hidden />
          {t("duplicate")}
        </Button>
      </div>
    </div>
  );
}
