import { useTranslations } from "next-intl";
import { Lock, LifeBuoy } from "lucide-react";

export default function FooterBand() {
  const t = useTranslations("dashboard.footer");
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-secondary/40 px-5 py-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
        {t("reassurance")}
      </span>
      <a
        href="tel:988"
        className="inline-flex items-center gap-1.5 font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
      >
        <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.75} />
        {t("crisis")}
      </a>
    </div>
  );
}
