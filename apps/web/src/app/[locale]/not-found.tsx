import { FileQuestion } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { cn } from "@/lib/utils";

export default async function NotFound() {
  const t = await getTranslations("marketing.notFound");
  return (
    <MarketingShell>
      <div className="mx-auto max-w-xl px-4 py-20">
        <EmptyState
          icon={FileQuestion}
          title={t("title")}
          description={t("body")}
          action={
            <Link href="/" className={cn(buttonVariants())}>
              {t("home")}
            </Link>
          }
        />
      </div>
    </MarketingShell>
  );
}
