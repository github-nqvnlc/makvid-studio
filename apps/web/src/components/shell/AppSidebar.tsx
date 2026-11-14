"use client";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Progress } from "@/components/ui/progress";
import { activeItem, NAV_ITEMS, type NavGroup } from "./nav-items";
import { UserMenu } from "./UserMenu";
import { WorkspaceSwitcher, type WorkspaceChoice } from "./WorkspaceSwitcher";

export interface Quota {
  used: number;
  limit: number | null;
}

const GROUPS: NavGroup[] = ["create", "workspace", "account", "admin"];

export function AppSidebar({
  allowed,
  workspaces,
  quota,
  user,
}: {
  allowed: string[];
  workspaces: WorkspaceChoice[];
  quota: Quota | null;
  user: { name: string; email: string; image: string | null };
}) {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const pathname = usePathname();
  const active = activeItem(pathname);
  const label = (l: string) => (l.startsWith("shell:") ? t(l.slice(6) as "profile") : tn(l as "projects"));
  const pct = quota?.limit ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;
  const warn = quota?.limit ? pct >= 80 : false;

  return (
    <Sidebar collapsible="icon" aria-label={t("mainNav")}>
      <SidebarHeader>
        <Link href="/" className="px-2 pt-1 text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
          MakVid Studio
        </Link>
        <WorkspaceSwitcher workspaces={workspaces} />
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((g) => {
          const items = NAV_ITEMS.filter((i) => i.group === g && allowed.includes(i.id));
          if (!items.length) return null;
          return (
            <SidebarGroup key={g}>
              <SidebarGroupLabel>{t(`groups.${g}`)}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((i) => (
                  <SidebarMenuItem key={i.id}>
                    <SidebarMenuButton asChild isActive={active === i.id} tooltip={label(i.label)}>
                      <Link href={i.href} aria-current={active === i.id ? "page" : undefined}>
                        <i.icon className="size-5" aria-hidden />
                        <span>{label(i.label)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        {quota && (
          <div className="flex flex-col gap-1.5 px-2 group-data-[collapsible=icon]:hidden" data-testid="quota-meter">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{t("quota.label")}</span>
              <span className={warn ? "text-destructive flex items-center gap-1" : "text-muted-foreground"}>
                {warn && <AlertTriangle className="size-3" aria-hidden />}
                {quota.used} / {quota.limit ?? t("quota.unlimited")}
              </span>
            </div>
            {quota.limit !== null && <Progress value={pct} aria-label={t("quota.label")} />}
          </div>
        )}
        <UserMenu name={user.name} email={user.email} image={user.image} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
