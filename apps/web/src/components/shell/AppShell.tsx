// The signed-in frame: sidebar + topbar + content. Used by the (app) route group and by `/` for signed-in users.
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { usageSummary } from "@makvid/billing";
import { users } from "@makvid/db";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { server } from "@/server/deps";
import { can } from "@/server/rbac";
import { viewer } from "@/server/session";
import { listWorkspaces } from "@/server/workspaces";
import { AppSidebar, type Quota } from "./AppSidebar";
import { NAV_ITEMS } from "./nav-items";
import { Topbar } from "./Topbar";

export async function AppShell({ children }: { children: ReactNode }) {
  const v = await viewer();
  // Pages redirect signed-out visitors themselves; the frame only exists for a real session.
  if (!v) return <>{children}</>;

  const allowed = NAV_ITEMS.filter((i) => {
    if (!i.needs) return true;
    return i.needs === "admin" ? v.isPlatformAdmin : can(v.role, i.needs);
  }).map((i) => i.id);

  const [workspaces, quota, jar, me] = await Promise.all([
    listWorkspaces(v).catch(() => [{ id: v.workspaceId, name: "Workspace", role: v.role, current: true }]),
    usageSummary(server().db, v.workspaceId)
      .then((u): Quota => ({ used: Number(u.used.videos ?? 0), limit: u.plan.limits.videos }))
      .catch(() => null),
    cookies(),
    server().db.select({ image: users.image }).from(users).where(eq(users.id, v.userId)).then((r) => r[0]?.image ?? null).catch(() => null),
  ]);
  const defaultOpen = jar.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar allowed={allowed} workspaces={workspaces} quota={quota} user={{ name: v.name, email: v.email, image: me }} />
      <SidebarInset id="main" className="min-w-0">
        <Topbar allowed={allowed} />
        <div className="w-full flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
