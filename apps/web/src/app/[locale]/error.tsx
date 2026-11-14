"use client";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/common/ErrorState";

export default function LocaleError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("marketing.error");
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="mb-4 text-center text-2xl font-semibold">{t("title")}</h1>
      <ErrorState message={t("body")} onRetry={reset} />
    </div>
  );
}
