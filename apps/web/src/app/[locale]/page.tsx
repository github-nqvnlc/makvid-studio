import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Landing } from "@/components/marketing/Landing";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { ProjectsView } from "@/components/projects/ProjectsView";
import { AppShell } from "@/components/shell/AppShell";
import { can } from "@/server/rbac";
import { viewer } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v)
    return (
      <MarketingShell>
        <Landing locale={locale} />
      </MarketingShell>
    );
  const edit = can(v.role, "create");
  return (
    <AppShell>
      <Suspense>
        <ProjectsView canEdit={edit} canCreate={edit} />
      </Suspense>
    </AppShell>
  );
}
