import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center" data-testid="empty-state">
      <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="text-lg font-medium">{title}</h2>
      {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
      {action}
    </div>
  );
}
