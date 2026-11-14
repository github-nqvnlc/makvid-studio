"use client";
import { Building2, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export interface WorkspaceChoice {
  id: string;
  name: string;
  current: boolean;
}

export function WorkspaceSwitcher({ workspaces }: { workspaces: WorkspaceChoice[] }) {
  const t = useTranslations("shell.workspaceSwitcher");
  const router = useRouter();
  const current = workspaces.find((w) => w.current) ?? workspaces[0];

  async function pick(id: string) {
    if (id === current?.id) return;
    const res = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId: id }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton aria-label={t("label")} data-testid="workspace-switcher" className="border">
              <Building2 className="size-5" aria-hidden />
              <span className="truncate">{current?.name}</span>
              {workspaces.length > 1 && <ChevronsUpDown className="ml-auto size-4" aria-hidden />}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {workspaces.length > 1 && (
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={current?.id} onValueChange={(v) => void pick(v)}>
                {workspaces.map((w) => (
                  <DropdownMenuRadioItem key={w.id} value={w.id}>
                    {w.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
