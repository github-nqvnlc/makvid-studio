import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { viewer } from "@/server/session";
import { SignOutButton } from "@/components/SignOutButton";
import "../globals.css";

export const metadata: Metadata = { title: "MakVid Studio" };

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const v = await viewer();
  const other = locale === "vi" ? "en" : "vi";
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <div className="shell">
            <header className="topbar">
              <Link href="/" className="brand">
                MakVid Studio
              </Link>
              {v ? (
                <>
                  <Link href="/">{t("projects")}</Link>
                  <Link href="/projects/new">{t("newProject")}</Link>
                  <Link href="/workspace/brand">{t("brand")}</Link>
                  <Link href="/workspace/assets">{t("assets")}</Link>
                  <Link href="/batches">{t("batches")}</Link>
                  <Link href="/workspace/members">{t("members")}</Link>
                  <Link href="/workspace/billing">{t("billing")}</Link>
                  <Link href="/workspace/api">{t("api")}</Link>
                  {v.isPlatformAdmin && <Link href="/admin">Admin</Link>}
                  <span className="muted small">{v.name || v.email}</span>
                  <SignOutButton label={t("signOut")} />
                </>
              ) : (
                <>
                  <Link href="/sign-in">{t("signIn")}</Link>
                  <Link href="/sign-up">{t("signUp")}</Link>
                </>
              )}
              <Link href="/" locale={other} className="small">
                {t("language")}
              </Link>
            </header>
            <main>{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
