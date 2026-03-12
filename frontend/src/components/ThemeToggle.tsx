"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type ThemeToggleProps = {
  collapsed?: boolean;
  className?: string;
};

export function ThemeToggle({ collapsed = false, className }: ThemeToggleProps) {
  const themeContext = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || !themeContext) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-9 w-9 shrink-0", collapsed && "h-9 w-9", className)}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const { setTheme, resolvedTheme } = themeContext;
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  const button = (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9 shrink-0 transition-colors hover:bg-muted", collapsed && "h-9 w-9", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
