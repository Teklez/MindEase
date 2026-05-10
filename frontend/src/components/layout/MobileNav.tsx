"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import { useGroupsUnread } from "@/hooks/useGroupsUnread";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  user: { display_name: string } | null;
  onNavigate: () => void;
  onLogout: () => void;
};

const LINKS: Array<{
  href: string;
  labelKey: "dashboard" | "chat" | "avatar" | "moodTracker" | "resources" | "assessments" | "groups" | "settings";
  icon: LucideIcon;
  disabled?: boolean;
}> = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/chat", labelKey: "chat", icon: MessageCircle },
  { href: "/avatar", labelKey: "avatar", icon: Sparkles },
  { href: "/mood", labelKey: "moodTracker", icon: HeartPulse },
  { href: "/resources", labelKey: "resources", icon: BookOpen },
  { href: "/assessments", labelKey: "assessments", icon: ClipboardList },
  { href: "/groups", labelKey: "groups", icon: Users },
  { href: "/settings", labelKey: "settings", icon: Settings, disabled: true },
];

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function MobileNav({ user, onNavigate, onLogout }: Props) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { hasUnread: groupsHaveUnread, count: groupsUnreadCount } =
    useGroupsUnread();

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <Logo size="md" asLink={false} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
        <ul className="space-y-1">
          {LINKS.map(({ href, labelKey, icon: Icon, disabled }) => {
            const active =
              !disabled &&
              pathname &&
              (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
            const className = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active && "bg-primary/10 text-primary",
              !active && !disabled && "text-foreground hover:bg-muted",
              disabled && "cursor-not-allowed text-muted-foreground",
            );
            const showUnread = labelKey === "groups" && groupsHaveUnread;
            const inner = (
              <>
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="flex-1">{tNav(labelKey)}</span>
                {showUnread && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {groupsUnreadCount}
                  </span>
                )}
                {disabled && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {tCommon("comingSoon").toLowerCase()}
                  </span>
                )}
              </>
            );
            return (
              <li key={href}>
                {disabled ? (
                  <span className={className}>{inner}</span>
                ) : (
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={className}
                    aria-current={active ? "page" : undefined}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </nav>

      <div className="border-t border-border px-3 py-4">
        {user && (
          <div className="mb-2 flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {getInitials(user.display_name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{user.display_name}</span>
          </div>
        )}
        <button
          onClick={() => {
            onNavigate();
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          {tNav("logout")}
        </button>
      </div>
    </div>
  );
}
