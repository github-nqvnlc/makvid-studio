import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { voiceOptions } from "@/server/catalog";
import { viewer } from "@/server/session";
import { CreateForm } from "@/components/CreateForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await viewer())) redirect({ href: "/sign-in", locale });
  return <CreateForm voices={voiceOptions()} />;
}
