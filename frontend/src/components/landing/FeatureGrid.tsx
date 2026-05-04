import { useTranslations } from "next-intl";
import { MessageCircle, HeartPulse, BookOpen, LifeBuoy } from "lucide-react";

const ICONS = [MessageCircle, HeartPulse, BookOpen, LifeBuoy];

type Feature = { title: string; body: string };

export default function FeatureGrid() {
  const t = useTranslations("landing.v2.features");
  const items = t.raw("items") as Feature[];

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-28 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-[36px] leading-[1.08] tracking-tight text-foreground sm:text-[48px] md:text-[56px]">
            {t("title")} <em className="text-primary">{t("titleEm")}</em>
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-4">
          {items.map((feature, i) => {
            const Icon = ICONS[i] ?? MessageCircle;
            return (
              <div
                key={feature.title}
                className="group flex flex-col rounded-2xl border border-border bg-card p-7 transition-all hover:border-primary/30 hover:shadow-soft-md"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <h3 className="mt-5 text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
