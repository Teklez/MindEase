"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, LayoutDashboard, MessageCircle, Sparkles, HeartPulse, BookOpen, ClipboardList, Users, type LucideIcon } from "lucide-react";
import { getMe, clearStoredToken } from "@/lib/api";
import Logo from "@/components/shared/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import UserMenu from "@/components/layout/UserMenu";
import MobileNav from "@/components/layout/MobileNav";
import { cn } from "@/lib/utils";

const NAV_LINKS: Array<{
  href: string;
  labelKey: "dashboard" | "chat" | "avatar" | "moodTracker" | "resources" | "assessments" | "groups";
  icon: LucideIcon;
}> = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/chat", labelKey: "chat", icon: MessageCircle },
  { href: "/avatar", labelKey: "avatar", icon: Sparkles },
  { href: "/mood", labelKey: "moodTracker", icon: HeartPulse },
  { href: "/resources", labelKey: "resources", icon: BookOpen },
  { href: "/assessments", labelKey: "assessments", icon: ClipboardList },
  { href: "/groups", labelKey: "groups", icon: Users },
];

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/chat") return pathname === "/chat" || pathname.startsWith("/chat/");
  if (href === "/avatar") return pathname === "/avatar";
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

  return (
    <header className="sticky top-0 z-40 h-16 w-full shrink-0 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/dashboard" className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Logo size="md" asLink={false} />
        </Link>

        <nav className="hidden md:flex h-full items-center gap-1" aria-label="Primary">
          {NAV_LINKS.map(({ href, labelKey, icon: Icon }) => {
            const label = tNav(labelKey);
            const active = isActive(href, pathname ?? null);
            const baseClass = cn(
              "relative inline-flex h-full items-center gap-2 px-3.5 text-[13.5px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            );
            const indicator = active ? (
              <span className="pointer-events-none absolute inset-x-3.5 -bottom-px h-0.5 rounded-t-sm bg-primary" />
            ) : null;
            return (
              <Link
                key={href}
                href={href}
                className={baseClass}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {label}
                {indicator}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex shrink-0" />
          <ThemeToggle className="hidden sm:inline-flex shrink-0" />
          <div className="hidden md:inline-flex">
            <UserMenu user={user} onLogout={handleLogout} />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            aria-label={tCommon("openMenu")}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[300px] p-0">
          <MobileNav user={user} onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
