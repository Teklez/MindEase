import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  const t = useTranslations("landing.v3.finalCta");
  return (
    <section className="border-t border-border bg-muted/60">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 md:px-10">
        <div className="flex flex-col items-center gap-5 py-24 text-center md:py-[96px]">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("eyebrow")}
          </span>
          <h2 className="max-w-[18ch] font-serif text-[36px] font-[360] leading-[1.04] tracking-[-0.018em] text-foreground text-balance md:text-[48px]">
            {t("headlineLead")}{" "}
            <em className="font-[360] text-primary" style={{ fontStyle: "italic" }}>
              {t("headlineEm")}
            </em>
          </h2>
          <p className="max-w-[38em] text-[18px] leading-[1.55] text-muted-foreground">
            {t("lede")}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-foreground px-5 text-[14px] font-medium text-background transition-colors hover:bg-foreground/85"
            >
              {t("ctaPrimary")}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-transparent px-5 text-[14px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
