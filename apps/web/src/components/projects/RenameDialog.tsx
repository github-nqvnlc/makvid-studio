"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RenameDialog({
  project,
  onClose,
  onSave,
}: {
  project: { id: string; title: string } | null;
  onClose: () => void;
  onSave: (id: string, title: string) => Promise<void>;
}) {
  const t = useTranslations("projectsList.rename");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValue(project?.title ?? "");
  }, [project]);
  if (!project) return null;
  const trimmed = value.trim();
  const error = trimmed.length === 0 ? t("empty") : trimmed.length > 200 ? t("tooLong") : null;

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (error) return;
            setBusy(true);
            try {
              await onSave(project.id, trimmed);
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-input">{t("label")}</Label>
            <Input id="rename-input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus aria-invalid={!!error} data-testid="rename-input" />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!!error || busy} data-testid="rename-save">
              {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
