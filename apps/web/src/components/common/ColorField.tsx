"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Swatch button (native picker in a popover) plus a validated #RRGGBB hex input. */
export function ColorField({
  value,
  onChange,
  label,
  name,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  name?: string;
  testId?: string;
}) {
  const t = useTranslations("common");
  const [draft, setDraft] = useState(value);
  const valid = HEX_RE.test(draft);
  function commit(v: string) {
    setDraft(v);
    if (HEX_RE.test(v)) onChange(v.toLowerCase());
  }
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger
          type="button"
          aria-label={label}
          className="border-input size-9 shrink-0 rounded-md border"
          style={{ backgroundColor: valid ? draft : value }}
        />
        <PopoverContent className="w-48">
          <input
            type="color"
            aria-label={label}
            className="h-24 w-full cursor-pointer"
            value={valid ? draft : value}
            onChange={(e) => commit(e.target.value)}
          />
        </PopoverContent>
      </Popover>
      <Input
        name={name}
        data-testid={testId}
        value={draft}
        onChange={(e) => commit(e.target.value)}
        className="font-mono"
        maxLength={7}
        aria-label={label}
        aria-invalid={!valid}
      />
      {!valid && (
        <span role="alert" className="text-destructive text-xs">
          {t("color.invalid")}
        </span>
      )}
    </div>
  );
}
