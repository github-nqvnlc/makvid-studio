import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

/** Legal and social pages do not exist yet, so they are shown with a badge and no link (spec FR-016). */
export async function Footer() {
  const t = await getTranslations("marketing");
  const soon = await getTranslations("common");
  const pending = (label: string) => (
    <li className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="outline">{soon("comingSoon")}</Badge>
    </li>
  );
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4 md:px-6">
        <div className="flex flex-col gap-2">
          <span className="text-lg font-bold">MakVid Studio</span>
          <p className="text-muted-foreground text-sm">{t("footer.tagline")}</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">{t("footer.product")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/#features" className="hover:underline">
                {t("nav.features")}
              </Link>
            </li>
            <li>
              <Link href="/#styles" className="hover:underline">
                {t("nav.styles")}
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:underline">
                {t("nav.pricing")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">{t("footer.resources")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/docs/api" className="hover:underline">
                {t("nav.docs")}
              </Link>
            </li>
          </ul>
          <h2 className="mt-5 mb-3 text-sm font-semibold">{t("footer.legal")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {pending(t("footer.terms"))}
            {pending(t("footer.privacy"))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold">{t("footer.social")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {pending(t("footer.youtube"))}
            {pending(t("footer.facebook"))}
            {pending(t("footer.tiktok"))}
          </ul>
        </div>
      </div>
      <div className="text-muted-foreground border-t py-4 text-center text-xs">
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
