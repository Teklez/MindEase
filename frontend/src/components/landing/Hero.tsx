import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Play } from "lucide-react";

type Stat = { num: string; lbl: string };

// TODO: replace Unsplash hotlinks with approved imagery in public/landing/ before launch.
const PHOTO_MORNING_LIGHT =
  "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=900&q=70";
const PHOTO_WARM_CUP =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=70";
const PHOTO_DETAIL =
  "https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?auto=format&fit=crop&w=400&q=70";

export default function Hero() {
  const t = useTranslations("landing.v3.hero");
  const stats = t.raw("stats") as Stat[];

  return (
    <header className="relative overflow-hidden pb-24 pt-16">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-[72px]">
          {/* Copy */}
          <div className="hero-copy">
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-border bg-background py-1.5 pl-2 pr-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-[3px] font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-primary">
                <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px_oklch(var(--primary)/0.25)]" />
                {t("pill")}
              </span>
              <span className="text-[12.5px] text-muted-foreground">{t("label")}</span>
            </div>

            <h1 className="font-serif text-[44px] font-[360] leading-[1.06] tracking-[-0.018em] text-foreground text-balance sm:text-[56px] md:text-[64px]">
              {t("headlineLead")}{" "}
              <em
                className="font-[360] text-primary"
                style={{ fontStyle: "italic" }}
              >
                {t("headlineEm")}
              </em>
            </h1>

            <p className="mt-8 max-w-[38em] text-[18px] leading-[1.55] text-muted-foreground">
              {t("lede")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link
                href="/register"
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-foreground px-5 text-[14px] font-medium text-background transition-colors hover:bg-foreground/85"
              >
                {t("ctaPrimary")}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
              </Link>
              <a
                href="#preview"
                className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-transparent px-5 text-[14px] font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Play className="h-3.5 w-3.5" strokeWidth={1.6} />
                {t("ctaSecondary")}
              </a>
            </div>

            <ul className="mt-9 flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-7">
              {stats.map((s) => (
                <li key={s.num} className="stat">
                  <div className="font-serif text-[28px] font-normal leading-tight tracking-[-0.01em] text-foreground">
                    {s.num}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{s.lbl}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* Art */}
          <div
            aria-hidden
            className="relative min-h-[520px] aspect-[1/1.1] lg:min-h-[620px]"
          >
            {/* Blurred blobs */}
            <div
              className="absolute -right-20 -top-16 h-[460px] w-[460px] rounded-full bg-primary/15 opacity-55 blur-[40px]"
            />
            <div
              className="absolute -left-16 bottom-5 h-[320px] w-[320px] rounded-full bg-accent/30 opacity-55 blur-[40px]"
            />

            {/* Photo 1 — large 4:5 top-right */}
            <div className="absolute right-0 top-0 z-[2] aspect-[4/5] w-[70%] overflow-hidden rounded-2xl border border-border bg-muted shadow-[0_1px_2px_rgba(20,30,25,0.04),0_24px_48px_-24px_rgba(20,30,25,0.18)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PHOTO_MORNING_LIGHT}
                alt={t("altMorningLight")}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Photo 2 — square bottom-left */}
            <div className="absolute bottom-0 left-0 z-[3] aspect-square w-[56%] overflow-hidden rounded-2xl border border-border bg-muted shadow-[0_1px_2px_rgba(20,30,25,0.04),0_24px_48px_-24px_rgba(20,30,25,0.18)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PHOTO_WARM_CUP}
                alt={t("altWarmCup")}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Photo 3 — circular detail bottom-right */}
            <div className="absolute bottom-[16%] right-[4%] z-[4] aspect-square w-[36%] overflow-hidden rounded-full border border-border bg-muted shadow-[0_1px_2px_rgba(20,30,25,0.04),0_24px_48px_-24px_rgba(20,30,25,0.18)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PHOTO_DETAIL}
                alt={t("altDetail")}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Chip 1 — MindEase reply */}
            <div className="absolute left-[-20px] top-[38%] z-[5] flex min-w-[220px] items-center gap-2.5 rounded-[10px] border border-border bg-card p-3 shadow-[0_12px_28px_-16px_rgba(20,30,25,0.22)]">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
                M
              </span>
              <div>
                <div className="text-[12px] text-muted-foreground">{t("chip1Who")}</div>
                <div className="text-[13px] text-foreground">{t("chip1Msg")}</div>
              </div>
            </div>

            {/* Chip 2 — mood logged */}
            <div className="absolute bottom-[4%] right-[-20px] z-[5] flex min-w-[220px] items-center gap-2.5 rounded-[10px] border border-border bg-card p-3 shadow-[0_12px_28px_-16px_rgba(20,30,25,0.22)]">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-border bg-muted text-[13px] font-semibold text-foreground">
                A
              </span>
              <div>
                <div className="text-[12px] text-muted-foreground">{t("chip2Who")}</div>
                <div className="flex items-center gap-1.5 text-[13px] text-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {t("chip2Msg")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
