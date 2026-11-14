import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { invitationInfo } from "@/server/members";
import { viewer } from "@/server/session";
import { AcceptInvite } from "@/components/AcceptInvite";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("invite");
  const tm = await getTranslations("members");
  const info = token.length >= 10 && token.length <= 100 ? await invitationInfo(token) : null;
  if (!info)
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Alert variant="destructive">
          <AlertDescription>{t("invalid")}</AlertDescription>
        </Alert>
      </div>
    );
  const v = await viewer();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p>{t("body", { workspace: info.workspaceName, role: tm(`role.${info.role}`) })}</p>
      {v ? (
        <AcceptInvite token={token} email={info.email} />
      ) : (
        <Link
          className={cn(buttonVariants())}
          href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
        >
          {t("signIn")}
        </Link>
      )}
    </div>
  );
}
