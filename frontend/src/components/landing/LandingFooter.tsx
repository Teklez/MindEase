import Link from "next/link";
import { useTranslations } from "next-intl";
import Logo from "@/components/shared/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingFooter() {
  const t = useTranslations("landing.v2.footer");

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-12 md:px-8 lg:px-12">
        <div className="md:col-span-5">
          <Logo size="md" href="/" />
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
            {t("tagline")}
          </p>
          <div className="mt-6 flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <div className="md:col-span-7 grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("product")}
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="#how-it-works" className="text-foreground/80 hover:text-foreground">
                  {t("links.howItWorks")}
                </a>
              </li>
              <li>
                <Link href="/dashboard" className="text-foreground/80 hover:text-foreground">
                  {t("links.dashboard")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("legal")}
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/privacy" className="text-foreground/80 hover:text-foreground">
                  {t("links.privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-foreground/80 hover:text-foreground">
                  {t("links.terms")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("support")}
            </h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href="tel:988" className="text-foreground/80 hover:text-foreground">
                  {t("links.crisis")}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-muted-foreground md:px-8 lg:px-12">
          <span>{t("copyright")}</span>
        </div>
      </div>
    </footer>
  );
}
