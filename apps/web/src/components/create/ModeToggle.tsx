"use client";
// Automatic (off) or step-by-step approval (on), with a one-line explanation of the current choice.
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type Mode = "auto" | "review";

export function ModeToggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  const t = useTranslations("create");
  const id = useId();
  return (
    <div className="flex items-center gap-2" data-mode={value}>
      <Switch
        id={id}
        checked={value === "review"}
        onCheckedChange={(on) => onChange(on ? "review" : "auto")}
        data-testid="mode-toggle"
        aria-describedby={`${id}-hint`}
      />
      <div className="flex flex-col leading-tight">
        <Label htmlFor={id} className="font-normal">
          {t("composer.stepByStep")}
        </Label>
        <span id={`${id}-hint`} className="text-muted-foreground text-xs">
          {t(value === "auto" ? "autoHint" : "reviewHint")}
        </span>
      </div>
    </div>
  );
}
