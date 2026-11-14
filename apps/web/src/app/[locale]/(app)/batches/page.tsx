import { getTranslations, setRequestLocale } from "next-intl/server";
import { planOf } from "@makvid/billing";
import { redirect } from "@/i18n/navigation";
import { listBatches } from "@/server/batches";
import { server } from "@/server/deps";
import { listTemplates } from "@/server/templates";
import { viewer } from "@/server/session";
import { BatchesPanel } from "@/components/BatchesPanel";
import { UpgradeCard } from "@/components/common/UpgradeCard";

export const dynamic = "force-dynamic";

export default async function BatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  const [templates, batches, plan] = await Promise.all([
    listTemplates(v.workspaceId),
    listBatches(v.workspaceId),
    planOf(server().db, v.workspaceId),
  ]);
  const { template } = await searchParams;
  if (!plan.limits.batch_enabled) {
    const tl = await getTranslations("common.planLock");
    return <UpgradeCard feature={tl("batch")} description={tl("batchBody")} />;
  }
  return (
    <BatchesPanel
      templates={templates.map((t) => ({ id: t.id, name: t.name, variables: t.variables }))}
      batches={batches.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }))}
      maxConcurrency={Math.max(1, plan.limits.concurrent_jobs)}
      {...(template ? { initialTemplate: template } : {})}
    />
  );
}
