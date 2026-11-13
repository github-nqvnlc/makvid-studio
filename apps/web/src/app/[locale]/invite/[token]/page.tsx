import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { invitationInfo } from "@/server/members";
import { viewer } from "@/server/session";
import { AcceptInvite } from "@/components/AcceptInvite";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite");
  const tm = await getTranslations("members");
  const info = token.length >= 10 && token.length <= 100 ? await invitationInfo(token) : null;
  if (!info)
    return (
      <section className="card stack">
        <h1>{t("title")}</h1>
        <p className="error">{t("invalid")}</p>
      </section>
    );
  const v = await viewer();
  return (
    <section className="card stack">
      <h1>{t("title")}</h1>
      <p>{t("body", { workspace: info.workspaceName, role: tm(`role.${info.role}`) })}</p>
      {v ? (
        <AcceptInvite token={token} email={info.email} />
      ) : (
        <Link className="btn primary" href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}>
          {t("signIn")}
        </Link>
      )}
    </section>
  );
}
