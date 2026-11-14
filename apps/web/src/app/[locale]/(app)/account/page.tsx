import { eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { users } from "@makvid/db";
import { PageHeader } from "@/components/common/PageHeader";
import { PasswordForm } from "@/components/account/PasswordForm";
import { PreferencesCard } from "@/components/account/PreferencesCard";
import { ProfileForm } from "@/components/account/ProfileForm";
import { redirect } from "@/i18n/navigation";
import { server } from "@/server/deps";
import { viewer } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  const t = await getTranslations("account");
  const [u] = await server().db.select({ image: users.image }).from(users).where(eq(users.id, v.userId));
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ProfileForm name={v.name} email={v.email} image={u?.image ?? null} />
      <PasswordForm />
      <PreferencesCard />
    </div>
  );
}
