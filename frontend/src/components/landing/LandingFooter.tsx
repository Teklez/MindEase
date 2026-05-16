import Link from "next/link";
import { useTranslations } from "next-intl";

function LeafMark() {
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21c0-7 4-12 9-13-1 9-5 13-9 13Z" />
        <path d="M12 21c0-5-3-9-8-10 1 7 4 10 8 10Z" />
      </svg>
    </span>
  );
}

export default function LandingFooter() {
  const t = useTranslations("landing.v3.footer");

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="grid gap-12 pb-10 pt-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-16">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5 font-serif text-[22px] font-medium tracking-[-0.01em] text-foreground"
            >
              <LeafMark />
              MindEase
            </Link>
            <p className="mt-3.5 max-w-[32ch] text-[13.5px] leading-[1.6] text-muted-foreground">
              {t("tagline")}
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {t("product")}
            </h4>
            <ul className="flex flex-col gap-2.5 text-[14px]">
              <li><Link href="/chat" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.chat")}</Link></li>
              <li><Link href="/mood" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.mood")}</Link></li>
              <li><Link href="/resources" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.resources")}</Link></li>
              <li><Link href="/assessments" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.assessments")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {t("company")}
            </h4>
            <ul className="flex flex-col gap-2.5 text-[14px]">
              <li><a href="#" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.about")}</a></li>
              <li><a href="#" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.research")}</a></li>
              <li><a href="#" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.careers")}</a></li>
              <li><a href="#" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.contact")}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {t("trust")}
            </h4>
            <ul className="flex flex-col gap-2.5 text-[14px]">
              <li><Link href="/privacy" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.privacy")}</Link></li>
              <li><Link href="/terms" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.terms")}</Link></li>
              <li><a href="#safety" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.safety")}</a></li>
              <li><a href="tel:988" className="text-foreground/80 transition-colors hover:text-foreground">{t("links.crisis")}</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-[22px] text-[12.5px] text-muted-foreground">
          <span>{t("copyright")}</span>
          <div className="flex gap-6">
            <span>
              EN · <span className="font-['Noto_Sans_Ethiopic',sans-serif]">አማ</span>
            </span>
            <span>{t("version")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
