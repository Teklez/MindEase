import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, Feather } from "lucide-react";

export default function ReflectionCard() {
  const t = useTranslations("dashboard.reflection");
  return (
    <article className="rounded-2xl border border-border bg-gradient-to-b from-primary/[0.06] to-card p-6 shadow-soft-sm">
      <div className="flex items-center gap-2">
        <Feather className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {t("eyebrow")}
        </span>
      </div>
      <p className="mt-4 font-serif text-lg leading-snug text-foreground">{t("prompt")}</p>
      <Link
        href="/chat"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        {t("cta")} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      </Link>
    </article>
  );
}
