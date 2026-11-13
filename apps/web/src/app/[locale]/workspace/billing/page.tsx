import { setRequestLocale } from "next-intl/server";
import { asc, eq } from "drizzle-orm";
import { usageSummary } from "@makvid/billing";
import { plans } from "@makvid/db";
import { redirect } from "@/i18n/navigation";
import { payments, server } from "@/server/deps";
import { can } from "@/server/rbac";
import { viewer } from "@/server/session";
import { BillingPanel } from "@/components/BillingPanel";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  const lang = locale === "en" ? "en" : "vi";
  const { db } = server();
  const [usage, catalog] = await Promise.all([
    usageSummary(db, v.workspaceId),
    db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.sort)),
  ]);
  const name = (id: string) => catalog.find((p) => p.id === id)?.nameI18n[lang] ?? id;
  return (
    <BillingPanel
      usage={{
        planId: usage.plan.id,
        planName: name(usage.plan.id),
        watermark: usage.plan.watermark,
        periodStart: usage.plan.periodStart.toISOString(),
        periodEnd: usage.plan.periodEnd.toISOString(),
        used: usage.used as Record<string, number>,
        reserved: usage.reserved as Record<string, number>,
        credits: usage.credits,
        limits: usage.plan.limits,
      }}
      plans={catalog.map((p) => ({
        id: p.id,
        name: p.nameI18n[lang],
        priceUsd: Number(p.priceUsd),
        priceVnd: p.priceVnd,
        limits: p.limits,
        purchasableCard: !!p.polarProductId,
      }))}
      providers={Object.keys(payments().providers)}
      canPay={can(v.role, "billing")}
      paid={(await searchParams).paid === "1"}
    />
  );
}
