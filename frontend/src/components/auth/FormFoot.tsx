import Link from "next/link";
import { useTranslations } from "next-intl";

export default function FormFoot() {
  const t = useTranslations("auth.v2.common");
  return (
    <div className="mt-auto flex items-center justify-between border-t border-border pt-[18px] text-[12px] text-muted-foreground">
      <span>{t("version")}</span>
      <div className="flex gap-4">
        <Link href="/privacy" className="transition-colors hover:text-foreground">
          {t("footPrivacy")}
        </Link>
        <Link href="/terms" className="transition-colors hover:text-foreground">
          {t("footTerms")}
        </Link>
        <a href="mailto:support@mindease.co" className="transition-colors hover:text-foreground">
          {t("footHelp")}
        </a>
      </div>
    </div>
  );
}
