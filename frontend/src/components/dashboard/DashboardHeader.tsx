"use client";

import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "@/hooks/use-toast";

export default function DashboardHeader() {
  const t = useTranslations("dashboard.v2.header");

  const handleComingSoon = (label: string) => {
    toast({ title: t("comingSoonTitle"), description: `${label} — ${t("comingSoonBody")}` });
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span aria-hidden>— </span>
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          {t("crumbHome")}
        </Link>
        <span className="mx-1.5 opacity-50" aria-hidden>
          /
        </span>
        <span className="text-foreground">{t("crumbDashboard")}</span>
      </nav>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleComingSoon(t("notifications"))}
          aria-label={t("notifications")}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Bell className="h-4 w-4" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={() => handleComingSoon(t("settings"))}
          aria-label={t("settings")}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Settings className="h-4 w-4" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
