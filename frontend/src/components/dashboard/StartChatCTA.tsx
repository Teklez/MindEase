import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

export default function StartChatCTA() {
  const t = useTranslations("dashboard.v2.startChat");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-foreground p-7 text-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -inset-y-10 h-72 w-72 rounded-full bg-primary/60 opacity-35 blur-[70px]"
      />
      <div className="relative z-10 grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-background/75">
            {t("eyebrow")}
          </p>
          <h3 className="mt-2 font-serif text-[28px] font-[360] leading-[1.1] tracking-[-0.018em] text-background">
            {t("headlineLead")}{" "}
            <em className="font-[360] text-primary" style={{ fontStyle: "italic" }}>
              {t("headlineEm")}
            </em>
          </h3>
          <p className="mt-2 max-w-prose text-[14px] leading-[1.55] text-background/85">
            {t("body")}
          </p>
        </div>
        <Link
          href="/chat"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-background px-5 text-[14px] font-medium text-foreground transition-colors hover:bg-secondary"
        >
          {t("cta")}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </Link>
      </div>
    </div>
  );
}
