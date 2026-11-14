import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { listMembers } from "@/server/members";
import { assignableRoles } from "@/server/rbac";
import { viewer } from "@/server/session";
import { MembersPanel } from "@/components/MembersPanel";

export const dynamic = "force-dynamic";

export default async function MembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  const data = await listMembers(v.workspaceId);
  return (
    <MembersPanel
      data={JSON.parse(JSON.stringify(data))}
      me={v.userId}
      myRole={v.role}
      assignable={assignableRoles(v.role)}
    />
  );
}
