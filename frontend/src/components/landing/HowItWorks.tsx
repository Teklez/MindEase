import { useTranslations } from "next-intl";

type Step = { kicker: string; title: string; body: string };

export default function HowItWorks() {
  const t = useTranslations("landing.v2.steps");
  const items = t.raw("items") as Step[];

  return (
    <section id="how-it-works" className="border-y border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-28 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-[36px] leading-[1.08] tracking-tight text-foreground sm:text-[48px] md:text-[56px]">
            {t("title")} <em className="text-primary">{t("titleEm")}</em>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
          {items.map((step) => (
            <div
              key={step.kicker}
              className="group flex flex-col rounded-2xl border border-border bg-card p-7 shadow-soft-sm transition-all hover:-translate-y-0.5 hover:shadow-soft-md"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {step.kicker}
              </span>
              <h3 className="mt-4 font-serif text-2xl font-medium tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
