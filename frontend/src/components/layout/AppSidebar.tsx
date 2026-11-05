"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Info,
  Database,
  FileCode2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const mainNavItems = [
  {
    title: "Trang chủ",
    url: "/",
    icon: Home,
  },
  {
    title: "Thông tin hệ thống",
    url: "/infor",
    icon: Info,
  },
];

const externalNavItems = [
  {
    title: "Swagger API Docs",
    url: "http://localhost:3001/api/docs",
    icon: FileCode2,
  },
  {
    title: "pgAdmin Database",
    url: "http://localhost:5050",
    icon: Database,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand Header */}
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-4 py-0 bg-sidebar">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">
              Makvid Studio
            </span>
            <span className="text-[11px] text-sidebar-foreground/70 font-mono">
              Platform v1.0
            </span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Main Navigation */}
      <SidebarContent className="p-3 space-y-4 bg-sidebar">
        {/* Navigation Group 1 */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-wider px-2">
            Tổng quan
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map((item) => {
                const isActive = pathname === item.url;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={
                        <Link
                          href={item.url}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-xs"
                            : "text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                            }`}
                        />
                      }
                    >
                      <Icon className="size-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Services & Integrations */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-wider px-2">
            Dịch vụ &amp; Công cụ
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {externalNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
                        />
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="size-4 text-[#D97841]" />
                        <span>{item.title}</span>
                      </div>
                      <ExternalLink className="size-3 opacity-60 ml-auto" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Service Health Status Card */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold text-sidebar-foreground/60 uppercase tracking-wider px-2">
            Trạng thái Host
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2 pt-1">
            <div className="p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border/80 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sidebar-foreground/80">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Frontend (Next.js)
                </span>
                <span className="font-mono text-sidebar-foreground font-medium">3002</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sidebar-foreground/80">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Backend (NestJS)
                </span>
                <span className="font-mono text-sidebar-foreground font-medium">3001</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sidebar-foreground/80">
                  <span className="size-1.5 rounded-full bg-cyan-500" />
                  PostgreSQL (Docker)
                </span>
                <span className="font-mono text-sidebar-foreground font-medium">5432</span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Footer Profile */}
      <SidebarFooter className="border-t border-sidebar-border p-3 bg-sidebar">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer">
          <Avatar className="size-8 border border-sidebar-border">
            <AvatarImage src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&q=80" />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-semibold">
              MS
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-semibold text-sidebar-foreground truncate">
              Makvid Admin
            </span>
            <span className="text-[10px] text-sidebar-foreground/65 truncate">
              admin@admin.com
            </span>
          </div>
          <ShieldCheck className="size-4 text-[#D97841] shrink-0" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
