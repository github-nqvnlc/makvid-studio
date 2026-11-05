import React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-border bg-card/40",
        className
      )}
    >
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
        <Icon className="size-6" />
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>

      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mb-5">
          {description}
        </p>
      )}

      {action && (
        <Button
          onClick={action.onClick}
          size="sm"
          className="gap-1.5 cursor-pointer"
        >
          {ActionIcon && <ActionIcon className="size-3.5" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}

