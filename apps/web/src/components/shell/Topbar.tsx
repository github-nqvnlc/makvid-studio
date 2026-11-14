"use client";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandMenu } from "./CommandMenu";
import { NotificationBell } from "./NotificationBell";

/** One row, at most 64 px tall at 360 px wide: trigger, path, then icon buttons. */
export function Topbar({ allowed }: { allowed: string[] }) {
  const t = useTranslations("shell");
  const canCreate = allowed.includes("new");
  return (
    <header className="bg-background/90 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-3 backdrop-blur md:px-4">
      <SidebarTrigger aria-label={t("toggleSidebar")} />
      <Separator orientation="vertical" className="hidden h-5 sm:block" />
      <div className="hidden min-w-0 flex-1 sm:block">
        <Breadcrumbs />
      </div>
      <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
        <CommandMenu allowed={allowed} />
        {canCreate && (
          <Link
            href="/projects/new"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            aria-label={t("newVideoShort")}
            data-testid="topbar-new"
          >
            <Plus className="size-4" aria-hidden />
            <span className="hidden md:inline">{t("search.newVideo")}</span>
          </Link>
        )}
        <NotificationBell />
        <div className="hidden items-center gap-1.5 sm:flex">
          <LocaleSwitcher signedIn />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
