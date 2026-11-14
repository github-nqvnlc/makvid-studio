"use client";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Same switches as the topbar; the language one also saves to the profile (PATCH /api/me). */
export function PreferencesCard() {
  const t = useTranslations("account.preferences");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-sm">{t("theme")}</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">{t("language")}</span>
          <LocaleSwitcher signedIn />
        </div>
      </CardContent>
    </Card>
  );
}
