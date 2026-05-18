"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

function LeafMark() {
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21c0-7 4-12 9-13-1 9-5 13-9 13Z" />
        <path d="M12 21c0-5-3-9-8-10 1 7 4 10 8 10Z" />
      </svg>
    </span>
  );
}

export default function LandingNav() {
  const t = useTranslations("landing.v3.nav");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-30 w-full transition-colors",
        scrolled
          ? "border-b border-border bg-background/92 backdrop-blur-md"
          : "border-b border-transparent bg-background/80 backdrop-blur",
      )}
    >
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-6 px-10">
        <Link href="/" className="flex items-center gap-2.5 font-serif text-[22px] font-medium tracking-[-0.01em] text-foreground">
          <LeafMark />
          MindEase
        </Link>

        <div className="hidden items-center gap-9 text-[14px] text-muted-foreground md:flex">
          <a href="#how" className="transition-colors hover:text-foreground">{t("howItWorks")}</a>
          <a href="#features" className="transition-colors hover:text-foreground">{t("features")}</a>
          <a href="#preview" className="transition-colors hover:text-foreground">{t("product")}</a>
          <a href="#safety" className="transition-colors hover:text-foreground">{t("safety")}</a>
          <Link href="/resources" className="transition-colors hover:text-foreground">{t("resources")}</Link>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher className="text-muted-foreground" />
          <Link
            href="/login"
            className="hidden h-9 items-center px-3.5 text-[13px] font-medium text-foreground transition-colors hover:text-primary sm:inline-flex"
          >
            {t("signIn")}
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-foreground px-3.5 text-[13px] font-medium text-background transition-colors hover:bg-foreground/85"
          >
            {t("getStarted")}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    </nav>
  );
}
