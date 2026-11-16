"use client";
// Popover list of the six content types (name + hint). Items keep the `source-<kind>` test ids.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OptionList } from "./OptionList";
import { SOURCES, type SourceKind } from "./validation";

export function ContentTypeSelect({ value, onChange }: { value: SourceKind; onChange: (k: SourceKind) => void }) {
  const ts = useTranslations("source");
  const t = useTranslations("create.composer");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={`${t("typeLabel")}: ${ts(`${value}.name`)}`}
          data-testid="type-trigger"
        >
          <span>{ts(`${value}.name`)}</span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <OptionList
          label={ts("title")}
          value={value}
          options={SOURCES.map((k) => ({ value: k, label: ts(`${k}.name`), hint: ts(`${k}.hint`) }))}
          testId={(k) => `source-${k}`}
          onSelect={(k) => {
            onChange(k);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
