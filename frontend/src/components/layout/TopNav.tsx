"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, LayoutDashboard, MessageSquare, Smile, BookOpen, Settings, LogOut } from "lucide-react";
import { getMe, clearStoredToken } from "@/lib/api";
import Logo from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NAV_LINKS: Array<{
  href: string;
  labelKey: "dashboard" | "chat" | "moodTracker" | "resources";
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}> = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/chat", labelKey: "chat", icon: MessageSquare },
  { href: "/mood", labelKey: "moodTracker", icon: Smile },
  { href: "/resources", labelKey: "resources", icon: BookOpen, disabled: true },
];

function getInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/chat") return pathname === "/chat" || pathname.startsWith("/chat/");
  return pathname.startsWith(href);
}

export default function TopNav() {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [user, setUser] = useState<{ display_name: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    getMe().then((res) => {
      if (res.ok) setUser(res.data);
    });
  }, []);

  const handleLogout = () => {
    clearStoredToken();
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const navContent = (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-0">
      {NAV_LINKS.map(({ href, labelKey, icon: Icon, disabled }) => {
        const label = tNav(labelKey);
        const active = !disabled && isActive(href, pathname ?? null);
        const baseClass = cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active && "bg-primary/10 text-primary border-b-0 md:border-b-2 md:border-b-primary md:rounded-b-none",
          !active && !disabled && "text-foreground hover:bg-muted hover:text-foreground",
          disabled && "cursor-not-allowed opacity-60 text-muted-foreground"
        );
        if (disabled) {
          return (
            <span key={href} className={baseClass}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              <span className="text-xs text-muted-foreground">({tCommon("comingSoon").toLowerCase()})</span>
            </span>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            onClick={() => mobileOpen && setMobileOpen(false)}
            className={baseClass}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 h-14 w-full shrink-0 border-b border-border bg-background">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
        {/* Left: Logo */}
        <Link href="/dashboard" className="shrink-0">
          <Logo size="md" asLink={false} />
        </Link>

        {/* Center: Nav links (desktop) */}
        <div className="hidden flex-1 justify-center md:flex">{navContent}</div>

        {/* Right: Language + Theme + User (desktop) / Hamburger (mobile) */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="shrink-0" />
          <ThemeToggle className="shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-lg p-1.5 pr-2 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={tCommon("userMenu")}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {user ? getInitials(user.display_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:inline">
                  {user?.display_name ?? tCommon("loading")}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {tNav("dashboard")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings className="mr-2 h-4 w-4" />
                {tNav("settings")}
                <span className="ml-auto text-xs text-muted-foreground">({tCommon("comingSoon").toLowerCase()})</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                {tNav("logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            aria-label={tCommon("openMenu")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="flex flex-col gap-4 pt-6">
            <div className="px-4">
              <Logo size="md" asLink={false} />
            </div>
            <div className="px-2">{navContent}</div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
