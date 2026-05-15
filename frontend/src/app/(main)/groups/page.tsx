"use client";

import { useTranslations } from "next-intl";
import { Users2 } from "lucide-react";
import { MobileGroupsTrigger } from "./layout";

/**
 * Empty-state landing for /groups. The sidebar (mounted in layout.tsx) holds
 * search, tabs, category chips, and the group list — pages live entirely in
 * that sidebar from the user's perspective. This page just nudges them to
 * pick a circle on mobile (where the sidebar is behind a sheet).
 */
export default function GroupsHomePage() {
  const t = useTranslations("groups");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-4 py-3 lg:hidden">
        <MobileGroupsTrigger />
        <h1 className="font-serif text-[16px] font-medium">{t("title")}</h1>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary-deep">
            <Users2 className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h2 className="mt-5 font-serif text-[22px] leading-tight text-foreground">
            {t("title")}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
          <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="lg:hidden">— Tap the menu to browse circles</span>
            <span className="hidden lg:inline">— Pick a circle from the left to start</span>
          </p>
        </div>
      </div>
    </div>
  );
}
