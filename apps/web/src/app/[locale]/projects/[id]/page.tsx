import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { styleCards } from "@/server/catalog";
import { viewer } from "@/server/session";
import { Editor } from "@/components/Editor";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await viewer())) redirect({ href: "/sign-in", locale });
  return <Editor projectId={id} styles={styleCards(locale === "en" ? "en" : "vi")} />;
}
