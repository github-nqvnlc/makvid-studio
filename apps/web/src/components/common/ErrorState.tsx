"use client";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="border-destructive/40 flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
      <AlertCircle className="text-destructive size-6" aria-hidden />
      <p className="text-sm">{message ?? t("errors.generic")}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
