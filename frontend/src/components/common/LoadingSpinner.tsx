import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  size?: "sm" | "default" | "lg" | "xl";
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: "size-4",
  default: "size-6",
  lg: "size-8",
  xl: "size-10",
};

export function LoadingSpinner({
  size = "default",
  label,
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-muted-foreground",
        className
      )}
    >
      <Loader2 className={cn("animate-spin text-[#D97841]", sizeClasses[size])} />
      {label && <p className="text-xs text-muted-foreground">{label}</p>}
    </div>
  );
}

export function PageLoading({ message = "Đang tải dữ liệu..." }: { message?: string }) {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <LoadingSpinner size="lg" label={message} />
    </div>
  );
}

