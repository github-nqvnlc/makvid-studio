import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A real <select> (keyboard, mobile pickers and form tests work as usual) with the theme's input look. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input bg-background text-foreground h-9 rounded-md border px-3 py-1 text-sm shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
