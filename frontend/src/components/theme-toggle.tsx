"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="size-8 rounded-lg border-border">
        <Sun className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-8 rounded-lg border-border bg-card text-foreground hover:bg-muted cursor-pointer"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title="Chuyển chế độ Sáng / Tối (clo.nz theme)"
    >
      {theme === "dark" ? (
        <Sun className="size-4 text-amber-400 transition-all" />
      ) : (
        <Moon className="size-4 text-foreground transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

