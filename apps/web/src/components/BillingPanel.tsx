"use client";
// Plan, usage meters, plans and credit packs with checkout (US6, T142; ADR 0004).
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/common/PageHeader";
import { UsageMeter } from "@/components/common/UsageMeter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postJson } from "@/lib/api-client";

export interface PlanCard {
  id: string;
  name: string;
  priceUsd: number;
  priceVnd: number;
  limits: {
    videos: number | null;
    video_seconds: number | null;
    tts_chars: number | null;
    ai_images: number | null;
    max_video_seconds: number;
    batch_enabled: boolean;
    api_enabled: boolean;
    mediagen_enabled: boolean;
  };
  purchasableCard: boolean;
}
export interface Usage {
  planId: string;
  planName: string;
  watermark: boolean;
  periodStart: string;
  periodEnd: string;
  used: Record<string, number>;
  reserved: Record<string, number>;
  credits: number;
  limits: PlanCard["limits"];
}

const PACKS = [
  { id: "min30", min: 30, usd: 9, vnd: 230_000 },
  { id: "min120", min: 120, usd: 29, vnd: 740_000 },
] as const;

export function BillingPanel({
  usage,
  plans,
  providers,
  canPay,
  paid,
}: {
  usage: Usage;
  plans: PlanCard[];
  providers: string[];
  canPay: boolean;
  paid: boolean;
}) {
  const t = useTranslations("billing");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const card = providers.includes("polar") ? "polar" : providers.includes("mock") ? "mock" : null;
  const qr = providers.includes("payos") ? "payos" : null;
  const date = (s: string) => new Date(s).toLocaleDateString(locale);
  const vnd = (n: number) => n.toLocaleString("vi-VN") + " ₫";

  async function pay(provider: string, item: unknown) {
    setError(null);
    const r = await postJson<{ url: string }>("/api/billing/checkout", { provider, item, locale });
    if (!r.ok) return setError(te(r.error));
    window.location.href = r.data.url;
  }

  const used = (key: string) => (usage.used[key] ?? 0) + (usage.reserved[key] ?? 0);
  const videoPct = usage.limits.videos ? Math.round((used("videos") / usage.limits.videos) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("current", { plan: usage.planName })} />
      {paid && (
        <Alert>
          <AlertDescription>{t("paid")}</AlertDescription>
        </Alert>
      )}
      {videoPct >= 80 && (
        <Alert variant="destructive" data-testid="quota-warning">
          <AlertDescription>{t("nearLimit", { pct: Math.min(100, videoPct) })}</AlertDescription>
        </Alert>
      )}
      <Card data-testid="usage">
        <CardHeader>
          <CardTitle data-testid="current-plan">{t("current", { plan: usage.planName })}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("period", { from: date(usage.periodStart), to: date(usage.periodEnd) })}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {usage.watermark && <p className="text-sm">{t("watermark")}</p>}
          <UsageMeter label={t("videos")} used={used("videos")} limit={usage.limits.videos} />
          <UsageMeter
            label={t("seconds")}
            used={Math.round(used("video_seconds") / 60)}
            limit={usage.limits.video_seconds === null ? null : Math.round(usage.limits.video_seconds / 60)}
          />
          <UsageMeter label={t("tts")} used={used("tts_chars")} limit={usage.limits.tts_chars} />
          {usage.limits.mediagen_enabled && (
            <UsageMeter label={t("images")} used={used("ai_images")} limit={usage.limits.ai_images} />
          )}
          <p className="text-sm">{t("credits", { min: Math.floor(usage.credits / 60) })}</p>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("plans")}</h2>
        {!canPay && <p className="text-muted-foreground text-sm">{t("ownerOnly")}</p>}
        {canPay && !card && !qr && <p className="text-muted-foreground text-sm">{t("noProviders")}</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.id}
              data-testid={`plan-${p.id}`}
              className={p.id === usage.planId ? "border-primary" : undefined}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {p.name}
                  {p.id === usage.planId && <Badge>{t("currentBadge")}</Badge>}
                </CardTitle>
                <p className="text-2xl font-bold">
                  {p.priceUsd > 0 ? `$${p.priceUsd}` : "0"}
                  {p.priceUsd > 0 && (
                    <span className="text-muted-foreground text-sm font-normal">{t("perMonth")}</span>
                  )}
                  {p.priceVnd > 0 && (
                    <span className="text-muted-foreground text-sm font-normal"> · {vnd(p.priceVnd)}</span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <span>
                  {t("features", {
                    videos: p.limits.videos ?? "∞",
                    minutes: p.limits.video_seconds === null ? "∞" : Math.round(p.limits.video_seconds / 60),
                    max: p.limits.max_video_seconds,
                  })}
                </span>
                <span className="text-muted-foreground">
                  {[
                    p.limits.batch_enabled && t("batch"),
                    p.limits.api_enabled && t("api"),
                    p.limits.mediagen_enabled && t("mediagen"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {p.id !== "free" && p.id !== usage.planId && (
                  <div className="flex flex-wrap gap-2">
                    {card && (p.purchasableCard || card === "mock") && (
                      <Button
                        disabled={!canPay}
                        onClick={() => void pay(card, { kind: "plan", planId: p.id })}
                      >
                        {t("payCard")}
                      </Button>
                    )}
                    {qr && (
                      <Button
                        variant="outline"
                        disabled={!canPay}
                        onClick={() => void pay(qr, { kind: "plan", planId: p.id, months: 1 })}
                      >
                        {t("payQr")}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {canPay && (card || qr) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("creditsTitle")}</h2>
          <div className="flex flex-wrap gap-4">
            {PACKS.map((k) => (
              <Card key={k.id} className="min-w-52">
                <CardHeader>
                  <CardTitle className="text-base">{t("pack", { min: k.min })}</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    ${k.usd} · {vnd(k.vnd)}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {card && (
                    <Button
                      variant="outline"
                      onClick={() => void pay(card, { kind: "credits", packId: k.id })}
                    >
                      {t("payCard")}
                    </Button>
                  )}
                  {qr && (
                    <Button variant="outline" onClick={() => void pay(qr, { kind: "credits", packId: k.id })}>
                      {t("payQr")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
