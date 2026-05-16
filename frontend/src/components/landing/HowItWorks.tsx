import { useTranslations } from "next-intl";
import { Smile, MessageCircle, TrendingUp } from "lucide-react";

const ICONS = [Smile, MessageCircle, TrendingUp];

type Step = { num: string; title: string; body: string };

export default function HowItWorks() {
  const t = useTranslations("landing.v3.how");
  const steps = t.raw("steps") as Step[];

  return (
    <section id="how" className="py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="mb-16 grid items-end gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("eyebrow")}
            </span>
            <h2 className="mt-4 max-w-[14ch] font-serif text-[36px] font-[360] leading-[1.04] tracking-[-0.018em] text-foreground text-balance md:text-[48px]">
              {t("headlineLead")}{" "}
              <em className="font-[360] text-primary" style={{ fontStyle: "italic" }}>
                {t("headlineEm")}
              </em>
            </h2>
          </div>
          <p className="text-[16px] leading-[1.6] text-muted-foreground">{t("intro")}</p>
        </div>

        <div className="grid overflow-hidden rounded-2xl border-l border-t border-border bg-background md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = ICONS[i] ?? Smile;
            return (
              <div
                key={step.num}
                className="flex min-h-[280px] flex-col gap-4 border-b border-r border-border bg-background px-8 pb-10 pt-9"
              >
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {step.num}
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-md border border-border bg-background text-primary">
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
                </div>
                <h3 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
                  {step.title}
                </h3>
                <p className="max-w-[32ch] text-[14.5px] leading-[1.6] text-muted-foreground">
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
