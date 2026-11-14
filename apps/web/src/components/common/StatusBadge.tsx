"use client";
import { AlertTriangle, CheckCircle2, CircleDashed, Hourglass, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export type ProjectStatus =
  | "draft"
  | "ingesting"
  | "scripting"
  | "awaiting_script_review"
  | "styling"
  | "storyboarding"
  | "awaiting_storyboard_review"
  | "producing_audio"
  | "compiling"
  | "qa"
  | "rendering"
  | "ready"
  | "needs_attention"
  | "failed";

type Group = { variant: "default" | "secondary" | "destructive" | "outline"; icon: LucideIcon; spin?: boolean };

const WORKING: Group = { variant: "secondary", icon: Loader2, spin: true };
const WAITING: Group = { variant: "outline", icon: Hourglass };

const GROUPS: Record<ProjectStatus, Group> = {
  draft: { variant: "outline", icon: CircleDashed },
  ingesting: WORKING,
  scripting: WORKING,
  styling: WORKING,
  storyboarding: WORKING,
  producing_audio: WORKING,
  compiling: WORKING,
  qa: WORKING,
  rendering: WORKING,
  awaiting_script_review: WAITING,
  awaiting_storyboard_review: WAITING,
  ready: { variant: "default", icon: CheckCircle2 },
  needs_attention: { variant: "outline", icon: AlertTriangle },
  failed: { variant: "destructive", icon: XCircle },
};

/** One variant per status group, always with an icon so state never relies on color alone. */
export function StatusBadge({ status }: { status: ProjectStatus }) {
  const t = useTranslations("status");
  const g = GROUPS[status] ?? GROUPS.draft;
  const Icon = g.icon;
  return (
    <Badge variant={g.variant} data-status={status}>
      <Icon className={g.spin ? "size-3 motion-safe:animate-spin" : "size-3"} aria-hidden />
      {t(status)}
    </Badge>
  );
}
