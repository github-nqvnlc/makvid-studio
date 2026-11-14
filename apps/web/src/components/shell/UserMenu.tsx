"use client";
import { ChevronsUpDown, LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function UserMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const shown = name || email;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" aria-label={t("userMenu.label")} data-testid="user-menu">
              <Avatar className="size-8">
                {image && <AvatarImage src={image} alt="" />}
                <AvatarFallback>{shown.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{shown}</span>
              <ChevronsUpDown className="ml-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuLabel className="truncate font-normal">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">
                <User className="size-4" aria-hidden />
                {t("profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={async () => {
                await authClient.signOut();
                window.location.href = "/";
              }}
            >
              <LogOut className="size-4" aria-hidden />
              {tn("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
