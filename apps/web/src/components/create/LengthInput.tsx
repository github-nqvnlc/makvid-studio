"use client";
// Length in whole seconds, 30-180. Keeps `name="duration"` (e2e and the API); the raw text is validated.
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { LENGTH_MIN, parseLength } from "./validation";

export function LengthInput({ value, onChange }: { value: string; onChange: (raw: string) => void }) {
  const t = useTranslations("create");
  const id = useId();
  const invalid = parseLength(value) === null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          name="duration"
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t("duration")}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-err` : undefined}
          data-testid="length-input"
          placeholder={String(LENGTH_MIN)}
          className="h-8 w-16 text-center"
        />
        <span className="text-muted-foreground text-sm">{t("composer.secondsShort")}</span>
      </div>
      {invalid && (
        <p id={`${id}-err`} role="alert" className="text-foreground text-xs font-medium" data-testid="length-error">
          {t("durationHint")}
        </p>
      )}
    </div>
  );
}
