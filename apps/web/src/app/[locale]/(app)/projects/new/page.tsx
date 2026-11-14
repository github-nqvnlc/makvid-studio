import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getBrandKit } from "@/server/assets";
import { voiceOptions } from "@/server/catalog";
import { viewer } from "@/server/session";
import { CreateForm } from "@/components/create/CreateForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  return <CreateForm voices={voiceOptions()} hasBrand={!!(await getBrandKit(v.workspaceId))} />;
}
