"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, Download, LayoutDashboard, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { isGuestUser } from "@/lib/guest";
import { cn } from "@/lib/utils";

function getInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type Props = {
  user: { display_name: string } | null;
  onLogout: () => void;
  className?: string;
};

export default function UserMenu({ user, onLogout, className }: Props) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tExport = useTranslations("export");
  const initials = user ? getInitials(user.display_name) : "?";
  const name = user?.display_name ?? tCommon("loading");
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsGuest(isGuestUser());
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 py-1 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label={tCommon("userMenu")}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:inline">
            {name}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56 shadow-soft-md">
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" strokeWidth={1.75} />
            {tNav("dashboard")}
          </Link>
        </DropdownMenuItem>
        {!isGuest && (
          <DropdownMenuItem asChild>
            <Link href="/settings/memory">
              <Settings className="mr-2 h-4 w-4" strokeWidth={1.75} />
              {tNav("settings")}
            </Link>
          </DropdownMenuItem>
        )}
        {!isGuest && (
          <DropdownMenuItem asChild>
            <Link href="/settings/export">
              <Download className="mr-2 h-4 w-4" strokeWidth={1.75} />
              {tExport("navLink")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" strokeWidth={1.75} />
          {tNav("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
