import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { styleCards } from "@/server/catalog";
import { viewer } from "@/server/session";
import { EditorLayout } from "@/components/editor/EditorLayout";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await viewer())) redirect({ href: "/sign-in", locale });
  return <EditorLayout projectId={id} styles={styleCards(locale === "en" ? "en" : "vi")} />;
}
