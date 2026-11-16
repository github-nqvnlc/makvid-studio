import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getBrandKit } from "@/server/assets";
import { voiceOptions } from "@/server/catalog";
import { viewer } from "@/server/session";
import { CreateComposer } from "@/components/create/CreateComposer";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  return <CreateComposer voices={voiceOptions()} hasBrand={!!(await getBrandKit(v.workspaceId))} />;
}
