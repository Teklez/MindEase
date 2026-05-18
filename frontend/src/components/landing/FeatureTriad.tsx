import { useTranslations } from "next-intl";
import { MessageCircleHeart, Lock, Globe } from "lucide-react";

const ICONS = [MessageCircleHeart, Lock, Globe];

type FeatureItem = {
  title?: string;
  titlePrefix?: string;
  titleAmharic?: string;
  body: string;
  metaLeft: string;
  metaRight: string;
};

export default function FeatureTriad() {
  const t = useTranslations("landing.v3.featuresSection");
  const items = t.raw("items") as FeatureItem[];

  return (
    <section id="features" className="pb-24 md:pb-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="mb-16 grid items-end gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("eyebrow")}
            </span>
            <h2 className="mt-4 max-w-[14ch] font-serif text-[36px] font-[360] leading-[1.04] tracking-[-0.018em] text-foreground text-balance md:text-[48px]">
              {t("headline")}
            </h2>
          </div>
          <p className="text-[16px] leading-[1.6] text-muted-foreground">{t("intro")}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map((feature, i) => {
            const Icon = ICONS[i] ?? MessageCircleHeart;
            const isComingSoon = feature.metaRight?.toLowerCase().includes("coming");
            return (
              <article
                key={feature.title ?? feature.titlePrefix}
                className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-7 transition-colors hover:border-foreground/30"
              >
                <Icon className="h-9 w-9 text-primary" strokeWidth={1.4} />
                <h3 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
                  {feature.title ? (
                    feature.title
                  ) : (
                    <>
                      {feature.titlePrefix}
                      <span className="font-['Noto_Sans_Ethiopic',serif]">
                        {feature.titleAmharic}
                      </span>
                    </>
                  )}
                </h3>
                <p className="text-[14.5px] leading-[1.6] text-muted-foreground">{feature.body}</p>
                <div className="mt-2 flex items-center justify-between border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span>{feature.metaLeft}</span>
                  {isComingSoon ? (
                    <span className="rounded-full border border-border bg-muted/60 px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/80">
                      {feature.metaRight}
                    </span>
                  ) : (
                    <span>{feature.metaRight}</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
