import { useTranslations } from "next-intl";
import { MessageCircle, HeartPulse, BookOpen, LifeBuoy } from "lucide-react";
import { Section } from "@/components/shared/Section";
import { SectionHeading } from "@/components/shared/SectionHeading";

const ICONS = [MessageCircle, HeartPulse, BookOpen, LifeBuoy];

type Feature = { title: string; body: string };

export default function FeatureGrid() {
  const t = useTranslations("landing.v2.features");
  const items = t.raw("items") as Feature[];

  return (
    <Section className="bg-background">
      <div className="mx-auto max-w-3xl">
        <SectionHeading lead={t("title")} emphasis={t("titleEm")} />
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-4">
        {items.map((feature, i) => {
          const Icon = ICONS[i] ?? MessageCircle;
          return (
            <div
              key={feature.title}
              className="group flex flex-col rounded-2xl border border-border bg-card p-7 shadow-soft-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-md"
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
    </Section>
  );
}
