"use client";
// Voice picker: tabs by tier (with a one-line explanation), gender and region filters, a compact list, and a
// preview clip per voice (one plays at a time).
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { VoiceOption } from "@/server/catalog";
import { cn } from "@/lib/utils";

const TIERS = ["standard", "pro", "ultra"] as const;
const ALL = "all";

export function VoicePicker({
  voices,
  value,
  onChange,
}: {
  voices: VoiceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("voices");
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const selected = voices.find((v) => v.id === value);
  const [tier, setTier] = useState<(typeof TIERS)[number]>(selected?.tier ?? "standard");
  const [gender, setGender] = useState<string>(ALL);
  const [region, setRegion] = useState<string>(ALL);

  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );

  const shown = useMemo(
    () =>
      voices.filter(
        (v) => v.tier === tier && (gender === ALL || v.gender === gender) && (region === ALL || (v.region ?? "other") === region),
      ),
    [voices, tier, gender, region],
  );

  function listen(id: string) {
    audio.current?.pause();
    if (playing === id) {
      setPlaying(null);
      return;
    }
    const a = new Audio(`/api/voices/${encodeURIComponent(id)}/preview`);
    audio.current = a;
    setPlaying(id);
    a.onended = () => setPlaying(null);
    void a.play().catch(() => setPlaying(null));
  }

  return (
    <Tabs value={tier} onValueChange={(v) => setTier(v as typeof tier)} className="flex flex-col gap-3" data-testid="voice-picker">
      <TabsList>
        {TIERS.map((x) => (
          <TabsTrigger key={x} value={x}>
            {t(x)}
          </TabsTrigger>
        ))}
      </TabsList>
      <p className="text-muted-foreground text-sm">{t(`tierHint.${tier}`)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={gender} onValueChange={(v) => setGender(v || ALL)} variant="outline" size="sm" aria-label={t("gender")}>
          <ToggleGroupItem value={ALL}>{t("all")}</ToggleGroupItem>
          <ToggleGroupItem value="female">{t("female")}</ToggleGroupItem>
          <ToggleGroupItem value="male">{t("male")}</ToggleGroupItem>
        </ToggleGroup>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger size="sm" className="w-44" aria-label={t("region")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("all")}</SelectItem>
            {(["north", "central", "south", "other"] as const).map((r) => (
              <SelectItem key={r} value={r}>
                {t(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* One panel per tab so every trigger controls an element that exists; only the active one has content. */}
      {TIERS.map((x) => (
        <TabsContent key={x} value={x} forceMount className="data-[state=inactive]:hidden">
          {x === tier &&
            (shown.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {shown.map((v) => (
                  <li key={v.id} className={cn("flex items-center gap-2 rounded-lg border p-2", value === v.id && "border-primary ring-primary ring-1")}>
                    <button
                      type="button"
                      onClick={() => onChange(v.id)}
                      aria-label={v.name}
                      aria-pressed={value === v.id}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center">
                        {value === v.id && <Check className="text-primary size-4" aria-hidden />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          <span className="truncate">{v.name}</span>
                          {v.isDefault && <Badge variant="secondary">{t("default")}</Badge>}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {t(v.gender)} · {v.region ? t(v.region) : t("other")}
                        </span>
                      </span>
                    </button>
                    <Button type="button" variant="outline" size="sm" onClick={() => listen(v.id)} className="gap-1">
                      {playing === v.id ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                      {playing === v.id ? t("stop") : t("listen")}
                    </Button>
                  </li>
                ))}
              </ul>
            ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
