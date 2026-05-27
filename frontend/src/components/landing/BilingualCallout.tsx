"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

type Card = { quote: string; flag: string; meta: string; amharic?: boolean };

export default function BilingualCallout() {
  const t = useTranslations("landing.v3.bilingual");
  const locale = useLocale();
  const targetLocale = locale === "am" ? "en" : "am";
  const cards = t.raw("cards") as Card[];

  return (
    <section className="pb-24 md:pb-[120px]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 md:px-10">
        <div className="relative grid items-center gap-12 overflow-hidden rounded-[24px] bg-foreground p-6 text-background sm:p-8 md:grid-cols-2 md:gap-16 md:p-16">
          {/* Sage radial flourish bleeding from bottom-right */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -right-32 h-[460px] w-[460px] rounded-full bg-primary opacity-35 blur-[60px]"
          />

          <div className="relative">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-background/65">
              {t("eyebrow")}
            </span>
            <h2 className="mt-4 font-serif text-[36px] font-[320] leading-[1.06] tracking-[-0.018em] text-background text-balance md:text-[48px]">
              {t("headlineLead")}{" "}
              <em
                className="font-[320] text-background/80"
                style={{ fontStyle: "italic" }}
              >
                {t("headlineEm")}
              </em>
            </h2>
            <p className="mt-5 max-w-[36ch] text-[15px] leading-[1.6] text-background/80">
              {t("body")}
            </p>
            <div className="mt-7">
              <Link
                href={`/set-locale?locale=${targetLocale}&next=/`}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-primary/85"
              >
                {t("ctaPrefix")}
                <span className={targetLocale === "am" ? "font-['Noto_Sans_Ethiopic',sans-serif]" : undefined}>
                  {t("ctaLang")}
                </span>
              </Link>
            </div>
          </div>

          <div className="relative">
            {cards.map((card, i) => (
              <div
                key={i}
                className={
                  "rounded-2xl border border-background/15 bg-background/[0.06] p-7 backdrop-blur-sm " +
                  (i > 0 ? "mt-3.5" : "")
                }
              >
                <div
                  className={
                    "font-serif font-[360] leading-[1.4] tracking-[-0.01em] text-background " +
                    (card.amharic
                      ? "font-['Noto_Sans_Ethiopic',serif] text-[21px]"
                      : "text-[22px]")
                  }
                >
                  &ldquo;{card.quote}&rdquo;
                </div>
                <div className="mt-4 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-background/65">
                  <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-background/20 bg-background/10 font-mono text-[9px] text-background/80">
                    {card.flag}
                  </span>
                  {card.meta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
