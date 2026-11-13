"use client";
// Plan, usage meters, plans and credit packs with checkout (US6, T142; ADR 0004).
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

  const meter = (label: string, key: string, limit: number | null, scale = 1) => {
    const v = ((usage.used[key] ?? 0) + (usage.reserved[key] ?? 0)) / scale;
    const max = limit === null ? null : limit / scale;
    return (
      <li key={key} className="stack">
        <span className="row">
          <span>{label}</span>
          <span className="small muted" data-testid={`meter-${key}`}>
            {Math.round(v)} / {max === null ? t("unlimited") : Math.round(max)}
          </span>
        </span>
        {max !== null && (
          <div className="progress">
            <div style={{ width: `${Math.min(100, Math.round((v / Math.max(1, max)) * 100))}%` }} />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="stack">
      <h1>{t("title")}</h1>
      {paid && <p className="badge">{t("paid")}</p>}
      <section className="card stack" data-testid="usage">
        <h2 data-testid="current-plan">{t("current", { plan: usage.planName })}</h2>
        <p className="small muted">
          {t("period", { from: date(usage.periodStart), to: date(usage.periodEnd) })}
        </p>
        {usage.watermark && <p className="small">{t("watermark")}</p>}
        <ul className="list">
          {meter(t("videos"), "videos", usage.limits.videos)}
          {meter(t("seconds"), "video_seconds", usage.limits.video_seconds, 60)}
          {meter(t("tts"), "tts_chars", usage.limits.tts_chars)}
          {usage.limits.mediagen_enabled && meter(t("images"), "ai_images", usage.limits.ai_images)}
        </ul>
        <p className="small">{t("credits", { min: Math.floor(usage.credits / 60) })}</p>
      </section>
      <section className="card stack">
        <h2>{t("plans")}</h2>
        {!canPay && <p className="small muted">{t("ownerOnly")}</p>}
        {canPay && !card && !qr && <p className="small muted">{t("noProviders")}</p>}
        <div className="choices">
          {plans.map((p) => (
            <div key={p.id} className="choice stack" data-testid={`plan-${p.id}`}>
              <strong>{p.name}</strong>
              <span>
                {p.priceUsd > 0 ? `$${p.priceUsd}${t("perMonth")}` : "0"}
                {p.priceVnd > 0 && <span className="small muted"> · {vnd(p.priceVnd)}</span>}
              </span>
              <span className="small">
                {t("features", {
                  videos: p.limits.videos ?? "∞",
                  minutes: p.limits.video_seconds === null ? "∞" : Math.round(p.limits.video_seconds / 60),
                  max: p.limits.max_video_seconds,
                })}
              </span>
              <span className="small muted">
                {[
                  p.limits.batch_enabled && t("batch"),
                  p.limits.api_enabled && t("api"),
                  p.limits.mediagen_enabled && t("mediagen"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {canPay && p.id !== "free" && p.id !== usage.planId && (
                <span className="row">
                  {card && (p.purchasableCard || card === "mock") && (
                    <button
                      className="btn primary"
                      onClick={() => void pay(card, { kind: "plan", planId: p.id })}
                    >
                      {t("payCard")}
                    </button>
                  )}
                  {qr && (
                    <button
                      className="btn"
                      onClick={() => void pay(qr, { kind: "plan", planId: p.id, months: 1 })}
                    >
                      {t("payQr")}
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
      {canPay && (card || qr) && (
        <section className="card stack">
          <h2>{t("creditsTitle")}</h2>
          <div className="row">
            {PACKS.map((k) => (
              <span key={k.id} className="choice stack">
                <strong>{t("pack", { min: k.min })}</strong>
                <span className="small">
                  ${k.usd} · {vnd(k.vnd)}
                </span>
                <span className="row">
                  {card && (
                    <button className="btn" onClick={() => void pay(card, { kind: "credits", packId: k.id })}>
                      {t("payCard")}
                    </button>
                  )}
                  {qr && (
                    <button className="btn" onClick={() => void pay(qr, { kind: "credits", packId: k.id })}>
                      {t("payQr")}
                    </button>
                  )}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
