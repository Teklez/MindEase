import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.v2.forgot");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-[460px] text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          — Forgot password
        </span>
        <h1 className="mt-3 font-serif text-[36px] font-[380] leading-[1.1] tracking-[-0.018em] text-foreground">
          {t("title")}
        </h1>
        <p className="mt-4 text-[15px] leading-[1.55] text-muted-foreground">{t("subtitle")}</p>

        <Link
          href="/login"
          className="mt-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-primary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
          {t("backToSignin")}
        </Link>
      </div>
    </main>
  );
}
