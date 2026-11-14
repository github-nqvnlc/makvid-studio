"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DeleteTarget =
  | { kind: "one"; id: string; title: string }
  | { kind: "many"; n: number }
  | { kind: "all"; n: number };

/** One dialog for the three deletes. Many and all need the typed phrase (spec FR-055); all of them say "cannot be undone". */
export function DeleteDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onConfirm: (t: DeleteTarget) => Promise<void>;
}) {
  const t = useTranslations("projectsList.delete");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setTyped("");
  }, [target]);

  if (!target) return null;
  const needsPhrase = target.kind !== "one";
  const phrase = t("phrase");
  const ok = !needsPhrase || typed.trim().toUpperCase() === phrase;
  const title =
    target.kind === "one" ? t("oneTitle") : target.kind === "many" ? t("manyTitle", { n: target.n }) : t("allTitle", { n: target.n });
  const body =
    target.kind === "one" ? t("oneBody", { title: target.title }) : target.kind === "many" ? t("manyBody") : t("allBody");

  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent data-testid="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        {needsPhrase && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-phrase">{t("typeToConfirm", { phrase })}</Label>
            <Input id="delete-phrase" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-testid="delete-phrase" />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!ok || busy}
            data-testid="delete-confirm"
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(target);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
