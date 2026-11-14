"use client";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

/** Slider and number input kept in sync. The number input keeps `name="duration"` (e2e and the API). */
export function DurationField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useTranslations("create");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="duration">{t("duration")}</Label>
      <div className="flex items-center gap-4">
        <Slider min={30} max={180} step={5} value={[Math.min(180, Math.max(30, value || 30))]} onValueChange={([v]) => onChange(v ?? 30)} aria-label={t("durationSlider")} className="flex-1" />
        <Input
          id="duration"
          name="duration"
          type="number"
          min={30}
          max={180}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24"
        />
      </div>
      <p className="text-muted-foreground text-xs">{t("durationHint")}</p>
    </div>
  );
}
