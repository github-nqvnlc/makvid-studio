import { getTranslations, setRequestLocale } from "next-intl/server";
import { planOf } from "@makvid/billing";
import { redirect } from "@/i18n/navigation";
import { server } from "@/server/deps";
import { listApiKeys } from "@/server/public-api";
import { can } from "@/server/rbac";
import { viewer } from "@/server/session";
import { listWebhooks } from "@/server/webhook-endpoints";
import { ApiSettings } from "@/components/ApiSettings";

export const dynamic = "force-dynamic";

export default async function ApiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  if (!can(v.role, "api")) {
    const t = await getTranslations("errors");
    return <p className="error">{t("forbidden")}</p>;
  }
  const [keys, hooks, plan] = await Promise.all([
    listApiKeys(v.workspaceId),
    listWebhooks(v.workspaceId),
    planOf(server().db, v.workspaceId),
  ]);
  return (
    <ApiSettings
      keys={JSON.parse(JSON.stringify(keys))}
      hooks={JSON.parse(JSON.stringify(hooks))}
      apiEnabled={plan.limits.api_enabled}
    />
  );
}
