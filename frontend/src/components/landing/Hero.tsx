import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Lock, ShieldCheck, Heart } from "lucide-react";

export default function Hero() {
  const t = useTranslations("landing.v2.hero");
  const tPreview = useTranslations("landing.v2.preview");

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.5) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-16 md:grid-cols-12 md:gap-10 md:px-8 md:pb-32 md:pt-24 lg:px-12">
        <div className="md:col-span-7 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {t("eyebrow")}
          </div>

          <h1 className="mt-6 font-serif text-[44px] leading-[1.04] tracking-tight text-foreground sm:text-[60px] md:text-[72px] lg:text-[80px]">
            {t("headlineLead")}{" "}
            <em className="text-primary">{t("headlineEm")}</em>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t("lede")}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[15px] font-medium text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary/90 shadow-soft"
            >
              {t("primaryCta")}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-all hover:-translate-y-px hover:bg-muted"
            >
              {t("secondaryCta")}
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs uppercase tracking-wider text-muted-foreground">
            <li className="inline-flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              {t("trust.encrypted")}
            </li>
            <li className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              {t("trust.evidence")}
            </li>
            <li className="inline-flex items-center gap-2">
              <Heart className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
              {t("trust.noJudgment")}
            </li>
          </ul>
        </div>

        <div className="md:col-span-5 lg:col-span-5">
          <div className="relative">
            <div className="absolute inset-0 -z-10 -rotate-2 rounded-[28px] bg-secondary/70" aria-hidden />
            <div className="rounded-[28px] border border-border bg-card p-6 shadow-soft-md md:p-7">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-serif text-base text-foreground">a quiet evening</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  {tPreview("moodPill")}
                </span>
              </div>
              <div className="space-y-3 text-[14.5px] leading-relaxed">
                <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground">
                  {tPreview("user")}
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-foreground">
                  <span className="italic font-serif text-foreground/90">{tPreview("assistant")}</span>
                </div>
                <div className="flex items-center gap-1.5 pl-1 pt-1">
                  <span className="h-2 w-2 animate-bounce-dot rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce-dot rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce-dot rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
