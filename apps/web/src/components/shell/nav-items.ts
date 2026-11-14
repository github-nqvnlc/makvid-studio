import {
  CreditCard,
  FolderOpen,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Palette,
  PlusCircle,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "create" | "workspace" | "account" | "admin";

export interface NavItem {
  id: string;
  href: string;
  /** Key under `nav.` (or `shell.` when prefixed with "shell:"). */
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Shown only when the viewer may do this (mirrors server-side RBAC). */
  needs?: "create" | "batch" | "assets" | "brand" | "members" | "api" | "billing" | "admin";
}

export const NAV_ITEMS: NavItem[] = [
  { id: "projects", href: "/", label: "projects", icon: FolderOpen, group: "create" },
  { id: "new", href: "/projects/new", label: "newProject", icon: PlusCircle, group: "create", needs: "create" },
  { id: "batches", href: "/batches", label: "batches", icon: Layers, group: "create", needs: "batch" },
  { id: "brand", href: "/workspace/brand", label: "brand", icon: Palette, group: "workspace" },
  { id: "assets", href: "/workspace/assets", label: "assets", icon: ImageIcon, group: "workspace" },
  { id: "members", href: "/workspace/members", label: "members", icon: Users, group: "workspace" },
  { id: "billing", href: "/workspace/billing", label: "billing", icon: CreditCard, group: "account" },
  { id: "api", href: "/workspace/api", label: "api", icon: KeyRound, group: "account" },
  { id: "account", href: "/account", label: "shell:profile", icon: User, group: "account" },
  { id: "admin", href: "/admin", label: "admin", icon: Shield, group: "admin", needs: "admin" },
];

/** Longest matching prefix wins, so /projects/<id> highlights "Projects" and /batches/<id> highlights "Batches". */
export function activeItem(pathname: string): string | null {
  let best: { id: string; len: number } | null = null;
  for (const i of NAV_ITEMS) {
    const hit = i.href === "/" ? pathname === "/" || /^\/projects\/(?!new)[^/]+/.test(pathname) : pathname === i.href || pathname.startsWith(`${i.href}/`);
    if (hit && (!best || i.href.length > best.len)) best = { id: i.id, len: i.href.length };
  }
  return best?.id ?? null;
}
