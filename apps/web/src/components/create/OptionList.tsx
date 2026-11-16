"use client";
// A short list of single-choice options inside a popover. Plain radio buttons: Tab / arrows work without
// a search box, and screen readers announce "n of m". Used by the content-type and aspect-ratio selectors.
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function OptionList<T extends string>({
  label,
  value,
  options,
  onSelect,
  testId,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onSelect: (v: T) => void;
  testId: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-testid={testId(o.value)}
          onClick={() => onSelect(o.value)}
          onKeyDown={(e) => {
            // Arrow keys move between options like a native radio group.
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = Array.from(
              e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
            );
            const i = items.indexOf(e.currentTarget);
            items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
          }}
          className={cn(
            "hover:bg-muted focus-visible:ring-ring flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2",
            value === o.value && "bg-muted",
          )}
        >
          {o.icon}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{o.label}</span>
            {o.hint && <span className="text-muted-foreground text-xs">{o.hint}</span>}
          </span>
          <Check className={cn("mt-0.5 size-4 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} aria-hidden />
        </button>
      ))}
    </div>
  );
}
