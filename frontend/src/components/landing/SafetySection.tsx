import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

type Resource = { region: string; name: string; num: string; desc: string };

export default function SafetySection() {
  const t = useTranslations("landing.v3.safety");
  const resources = t.raw("resources") as Resource[];

  return (
    <section id="safety" className="border-t border-border py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 md:px-10">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("eyebrow")}
            </span>
            <h2 className="mt-4 font-serif text-[36px] font-[360] leading-[1.04] tracking-[-0.018em] text-foreground text-balance md:text-[48px]">
              {t("headlineLead")}{" "}
              <em className="font-[360] text-primary" style={{ fontStyle: "italic" }}>
                {t("headlineEm")}
              </em>
            </h2>
            <p className="mt-5 max-w-[38em] text-[18px] leading-[1.55] text-muted-foreground">
              {t("lede")}
            </p>
            <Link
              href="/privacy"
              className="mt-5 inline-flex items-center gap-2 text-[14px] font-medium text-primary transition-colors hover:text-foreground"
            >
              {t("cta")}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Link>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            {resources.map((r) => (
              <div
                key={r.region}
                className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-card p-[22px]"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {r.region}
                </span>
                <div className="font-serif text-[18px] font-normal tracking-[-0.005em] text-foreground">
                  {r.name}
                </div>
                <div className="font-serif text-[28px] font-normal tracking-[-0.01em] text-primary">
                  {r.num}
                </div>
                <div className="text-[13px] text-muted-foreground">{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
