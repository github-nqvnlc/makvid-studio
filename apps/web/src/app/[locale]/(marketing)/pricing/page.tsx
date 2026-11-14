import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { plans } from "@makvid/db";
import { server } from "@/server/deps";
import { viewer } from "@/server/session";
import { PricingTable } from "@/components/marketing/PricingTable";

export const dynamic = "force-dynamic";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === "en" ? "en" : "vi";
  const t = await getTranslations("marketing.pricing");
  const [rows, v] = await Promise.all([
    server().db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.sort)),
    viewer(),
  ]);
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 font-serif">{t("subtitle")}</p>
      </div>
      <PricingTable
        signedIn={!!v}
        plans={rows.map((p) => ({
          id: p.id,
          name: p.nameI18n[lang],
          priceUsd: Number(p.priceUsd),
          priceVnd: p.priceVnd,
          limits: p.limits,
          watermark: p.watermark,
        }))}
      />
    </section>
  );
}
