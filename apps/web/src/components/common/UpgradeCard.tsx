"use client";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shown in place of a plan-locked feature (FR-043): what it does, which plan has it, and how to upgrade. */
export function UpgradeCard({ feature, description }: { feature: string; description?: string }) {
  const t = useTranslations("common");
  return (
    <Card data-testid="upgrade-card">
      <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
          <Lock className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("upgrade.title", { feature })}</p>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        <Link href="/workspace/billing" className={cn(buttonVariants())}>
          {t("upgrade.action")}
        </Link>
      </CardContent>
    </Card>
  );
}
