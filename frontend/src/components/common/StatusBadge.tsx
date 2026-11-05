import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  pulse?: boolean;
  className?: string;
}

const variantStyles: Record<
  StatusVariant,
  { badge: string; dot: string }
> = {
  success: {
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  warning: {
    badge:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    dot: "bg-amber-500",
  },
  error: {
    badge: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
    dot: "bg-red-500",
  },
  info: {
    badge:
      "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
    dot: "bg-sky-500",
  },
  neutral: {
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

export function StatusBadge({
  status,
  variant = "neutral",
  pulse = false,
  className,
}: StatusBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full",
        styles.badge,
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full inline-block",
          styles.dot,
          pulse && "animate-pulse"
        )}
      />
      {status}
    </Badge>
  );
}

