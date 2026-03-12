import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Logo from "@/components/shared/Logo";

export default async function Home() {
  const t = await getTranslations("landing");
  const tDisclaimer = await getTranslations("disclaimer");
  const tCommon = await getTranslations("common");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/5 via-background to-muted/30">
      {/* Subtle animated background pattern */}
      <div
        className="fixed inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
        aria-hidden
      />

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-6 py-20 sm:py-28 text-center">
          <div className="max-w-2xl mx-auto">
            <Logo size="lg" asLink={false} className="text-3xl sm:text-4xl mb-6 inline-block" />
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground tracking-tight">
              {t("hero")}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {t("subtitle")}
            </p>
            <div className="mt-10 flex flex-wrap gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
              >
                {t("getStarted")}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border-2 border-primary/40 bg-transparent px-6 py-3 text-primary font-medium hover:bg-primary/10 transition-colors"
              >
                {t("signIn")}
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <span className="text-2xl" aria-hidden>🤝</span>
              <h2 className="mt-3 text-lg font-semibold text-foreground">{t("features.support.title")}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t("features.support.description")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
              <span className="text-2xl" aria-hidden>🔒</span>
              <h2 className="mt-3 text-lg font-semibold text-foreground">{t("features.privacy.title")}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t("features.privacy.description")}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md relative">
              <span className="text-2xl" aria-hidden>🌍</span>
              <span className="absolute top-4 right-4 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {tCommon("comingSoon")}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-foreground">{t("features.language.title")}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {t("features.language.description")}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-auto border-t border-border bg-muted/30 px-6 py-8">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {tDisclaimer("full")}
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
              <Link href="/privacy" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                {tCommon("privacyPolicy")}
              </Link>
              <Link href="/terms" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                {tCommon("termsOfService")}
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 {tCommon("appName")}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
