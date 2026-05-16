"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FormPanelTop() {
  const t = useTranslations("auth.v2.common");
  const locale = useLocale();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname ?? "/");

  return (
    <div className="flex items-center justify-between">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
        {t("backHome")}
      </Link>

      <div className="inline-flex items-center gap-0 rounded-full border border-border bg-muted p-[3px] font-mono text-[11px] tracking-[0.08em]">
        <a
          href={`/set-locale?locale=en&next=${next}`}
          aria-current={locale === "en" ? "true" : undefined}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            locale === "en"
              ? "bg-background text-foreground shadow-[0_1px_2px_rgba(20,30,25,0.06)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          EN
        </a>
        <a
          href={`/set-locale?locale=am&next=${next}`}
          aria-current={locale === "am" ? "true" : undefined}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            "font-['Noto_Sans_Ethiopic',sans-serif]",
            locale === "am"
              ? "bg-background text-foreground shadow-[0_1px_2px_rgba(20,30,25,0.06)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          አማ
        </a>
      </div>
    </div>
  );
}
