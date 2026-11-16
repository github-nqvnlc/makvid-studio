"use client";
// Popover list of the four aspect ratios, each with a small drawing of the frame.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { OptionList } from "./OptionList";

export const ASPECTS = ["9:16", "16:9", "1:1", "4:5"] as const;
export type Aspect = (typeof ASPECTS)[number];

const FRAME: Record<Aspect, string> = {
  "9:16": "h-5 w-3",
  "16:9": "h-3 w-5",
  "1:1": "h-4 w-4",
  "4:5": "h-[18px] w-3.5",
};

function Frame({ aspect }: { aspect: Aspect }) {
  return (
    <span className="flex size-5 items-center justify-center" aria-hidden>
      <span className={cn("border-foreground/60 rounded-[2px] border", FRAME[aspect])} />
    </span>
  );
}

export function AspectSelect({ value, onChange }: { value: Aspect; onChange: (a: Aspect) => void }) {
  const t = useTranslations("create");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={`${t("aspect")}: ${value}`}
          data-testid="aspect-trigger"
        >
          <Frame aspect={value} />
          <span className="font-mono">{value}</span>
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <OptionList
          label={t("aspect")}
          value={value}
          options={ASPECTS.map((a) => ({ value: a, label: t(`aspects.${a}`), icon: <Frame aspect={a} /> }))}
          testId={(a) => `aspect-${a}`}
          onSelect={(a) => {
            onChange(a);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
