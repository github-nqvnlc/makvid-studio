"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  FileCode2,
  ExternalLink,
  Bell,
  User,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function AppHeader() {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === "/") return "Trang chủ";
    if (pathname === "/infor") return "Thông tin hệ thống";
    return pathname.replace("/", "");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/70 px-4 md:px-6 backdrop-blur transition-[width,height] ease-linear">
      {/* Left: Sidebar trigger & Title */}
      <div className="flex items-center gap-3">
        <SidebarTrigger className="cursor-pointer hover:bg-muted p-2 rounded-lg" />

        <div className="h-4 w-px bg-border hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
            Makvid Studio
          </span>
          <span className="text-muted-foreground hidden sm:inline">/</span>
          <h2 className="text-sm font-semibold text-foreground tracking-tight">
            {getPageTitle()}
          </h2>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="hidden md:flex items-center w-full max-w-xs mx-4">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm chức năng..."
            className="pl-8 pr-12 h-8 text-xs bg-muted/50 border-border/70 focus-visible:ring-1 focus-visible:ring-ring"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] bg-background text-muted-foreground border border-border px-1.5 py-0.5 rounded font-mono">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Quick actions, ThemeToggle, User */}
      <div className="flex items-center gap-2.5">
        <a
          href="http://localhost:3001/api/docs"
          target="_blank"
          rel="noreferrer"
          className="hidden lg:inline-flex"
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <FileCode2 className="size-3.5 text-[#D97841]" />
            Swagger
            <ExternalLink className="size-3 opacity-60" />
          </Button>
        </a>

        <Badge
          variant="outline"
          className="border-border bg-secondary text-secondary-foreground text-xs hidden sm:inline-flex"
        >
          <span className="size-1.5 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse" />
          Port 3002
        </Badge>

        <ThemeToggle />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer" />
            }
          >
            <Avatar className="size-8 border border-border hover:ring-2 hover:ring-ring/40 transition-all">
              <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&q=80" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                MS
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 bg-card border-border text-foreground p-1.5 shadow-md"
          >
            <DropdownMenuLabel className="px-2 py-1.5">
              <p className="text-xs font-semibold text-foreground">
                Makvid Admin
              </p>
              <p className="text-[11px] text-muted-foreground font-normal">
                admin@admin.com
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border my-1" />
            <DropdownMenuItem
              render={<Link href="/infor" className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-muted cursor-pointer" />}
            >
              <User className="size-3.5 text-muted-foreground" />
              Thông tin hệ thống
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href="http://localhost:3001/api/docs" target="_blank" rel="noreferrer" className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-muted cursor-pointer" />}
            >
              <FileCode2 className="size-3.5 text-muted-foreground" />
              Tài liệu Swagger API
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border my-1" />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive focus:text-destructive px-2 py-1.5 text-xs rounded-md hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="size-3.5" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
