import React from "react";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  change?: {
    value: string | number;
    trend: "up" | "down" | "neutral";
    label?: string;
  };
  description?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  description,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-xs", className)}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          {Icon && (
            <div className="p-2 rounded-lg bg-muted text-foreground/80">
              <Icon className="size-4" />
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {value}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {change && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded text-[11px]",
                  change.trend === "up" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  change.trend === "down" && "bg-red-500/10 text-red-600 dark:text-red-400",
                  change.trend === "neutral" && "bg-muted text-muted-foreground"
                )}
              >
                {change.trend === "up" && <TrendingUp className="size-3" />}
                {change.trend === "down" && <TrendingDown className="size-3" />}
                {change.trend === "neutral" && <Minus className="size-3" />}
                {change.value}
              </span>
            )}

            {(change?.label || description) && (
              <span className="text-muted-foreground text-[11px]">
                {change?.label || description}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

