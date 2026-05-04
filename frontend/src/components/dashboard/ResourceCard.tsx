import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export default function ResourceCard() {
  const t = useTranslations("dashboard.resource");
  return (
    <article className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-accent" strokeWidth={1.75} />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {t("eyebrow")}
        </span>
      </div>
      <h3 className="mt-3 font-serif text-lg tracking-tight text-foreground">{t("title")}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{t("body")}</p>
      <Link
        href="/privacy"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
      >
        {t("cta")} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      </Link>
    </article>
  );
}
