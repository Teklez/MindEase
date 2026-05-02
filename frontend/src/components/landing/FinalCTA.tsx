import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  const t = useTranslations("landing.v2.finalCta");
  return (
    <section className="bg-secondary/40">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center md:px-8 md:py-32 lg:px-12">
        <h2 className="font-serif text-[40px] leading-[1.08] tracking-tight text-foreground sm:text-[52px] md:text-[60px]">
          {t("headlineLead")} <em className="text-primary">{t("headlineEm")}</em>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground">{t("lede")}</p>

        <Link
          href="/register"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-[15px] font-medium text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary/90 shadow-soft-md"
        >
          {t("cta")}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">{t("disclaimer")}</p>
      </div>
    </section>
  );
}
