import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { batchView, ProjectError } from "@makvid/pipeline";
import { redirect } from "@/i18n/navigation";
import { server } from "@/server/deps";
import { can } from "@/server/rbac";
import { viewer } from "@/server/session";
import { BatchProgress } from "@/components/BatchProgress";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BatchPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  if (!UUID.test(id)) notFound();
  try {
    const view = await batchView(server().deps, v.workspaceId, id);
    return <BatchProgress initial={JSON.parse(JSON.stringify(view))} canRun={can(v.role, "batch")} />;
  } catch (e) {
    if (e instanceof ProjectError) notFound();
    throw e;
  }
}
