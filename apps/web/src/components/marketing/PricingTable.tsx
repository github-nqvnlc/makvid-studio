"use client";
import { Check } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface PricingPlan {
  id: string;
  name: string;
  priceUsd: number;
  priceVnd: number;
  limits: {
    videos: number | null;
    video_seconds: number | null;
    max_video_seconds: number;
    batch_enabled: boolean;
    api_enabled: boolean;
    mediagen_enabled: boolean;
  };
  watermark: boolean;
}

/** Monthly prices from the plan catalog: VND for Vietnamese, USD for English. Yearly is not offered yet. */
export function PricingTable({ plans, signedIn }: { plans: PricingPlan[]; signedIn: boolean }) {
  const t = useTranslations("marketing.pricing");
  const soon = useTranslations("common");
  const f = useFormatter();
  const locale = useLocale();

  if (plans.length === 0) return <p className="text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex items-center gap-2">
        <ToggleGroup type="single" value="monthly" variant="outline" aria-label={t("billing")}>
          <ToggleGroupItem value="monthly">{t("monthly")}</ToggleGroupItem>
          <ToggleGroupItem value="yearly" disabled>
            {t("yearly")}
          </ToggleGroupItem>
        </ToggleGroup>
        <Badge variant="outline">{soon("comingSoon")}</Badge>
      </div>
      <ul className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="pricing-plans">
        {plans.map((p) => {
          const free = p.priceUsd === 0 && p.priceVnd === 0;
          const price = locale === "en" ? p.priceUsd : p.priceVnd;
          const features = [
            p.limits.videos === null ? t("videosUnlimited") : t("videos", { n: f.number(p.limits.videos) }),
            p.limits.video_seconds === null
              ? t("minutesUnlimited")
              : t("minutes", { n: f.number(Math.round(p.limits.video_seconds / 60)) }),
            t("maxLength", { n: f.number(p.limits.max_video_seconds) }),
            p.watermark ? t("watermark") : t("noWatermark"),
            p.limits.batch_enabled && t("batch"),
            p.limits.api_enabled && t("api"),
            p.limits.mediagen_enabled && t("mediagen"),
          ].filter((x): x is string => typeof x === "string");
          return (
            <li key={p.id} data-testid={`plan-${p.id}`}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <p className="text-3xl font-bold">
                    {free ? (
                      t("free")
                    ) : (
                      <>
                        {f.number(price, { style: "currency", currency: locale === "en" ? "USD" : "VND", maximumFractionDigits: locale === "en" ? 2 : 0 })}
                        <span className="text-muted-foreground text-sm font-normal">{t("perMonth")}</span>
                      </>
                    )}
                  </p>
                </CardHeader>
                <CardContent className="flex h-full flex-col gap-4">
                  <ul className="flex flex-col gap-2 text-sm">
                    {features.map((x) => (
                      <li key={x} className="flex items-start gap-2">
                        <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={signedIn ? "/workspace/billing" : "/sign-up"}
                    className={cn(buttonVariants({ variant: free ? "outline" : "default" }), "mt-auto")}
                  >
                    {free ? t("startFree") : t("choose")}
                  </Link>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
