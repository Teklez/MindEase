"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import Logo from "@/components/shared/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export default function LandingNav() {
  const t = useTranslations("landing.v2.nav");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b transition-all",
        scrolled
          ? "border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 shadow-soft-sm"
          : "border-transparent bg-background/60",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 md:px-8 lg:px-12">
        <Logo size="md" href="/" />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Marketing">
          <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("howItWorks")}
          </a>
          <a href="#privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("privacy")}
          </a>
          <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("resources")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/login"
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex px-3 py-1.5"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:bg-foreground/90 hover:-translate-y-px shadow-soft-sm"
          >
            {t("cta")}
          </Link>
        </div>
      </div>
    </header>
  );
}
