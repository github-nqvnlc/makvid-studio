"use client";
import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const ASPECTS = ["9:16", "16:9", "1:1", "4:5"] as const;
export type Aspect = (typeof ASPECTS)[number];

const FRAME: Record<Aspect, string> = { "9:16": "w-5 h-9", "16:9": "w-10 h-6", "1:1": "w-7 h-7", "4:5": "w-6 h-7" };

/** Radio cards that draw the actual frame shape. The form field name stays `aspect` for tests and the API. */
export function AspectCards({ value, onChange }: { value: Aspect; onChange: (a: Aspect) => void }) {
  const t = useTranslations("create");
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as Aspect)} className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t("aspect")}>
      {ASPECTS.map((a) => (
        <Label
          key={a}
          htmlFor={`aspect-${a}`}
          data-testid={`aspect-${a}`}
          className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 text-center font-normal", value === a && "border-primary ring-primary ring-1")}
        >
          <RadioGroupItem id={`aspect-${a}`} value={a} className="sr-only" />
          <span className="flex h-10 items-center">
            <span className={cn("border-foreground rounded-sm border-2", FRAME[a])} aria-hidden />
          </span>
          <span className="text-xs">{t(`aspects.${a}`)}</span>
        </Label>
      ))}
    </RadioGroup>
  );
}
