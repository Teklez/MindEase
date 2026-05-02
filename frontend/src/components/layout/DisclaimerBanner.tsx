"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LifeBuoy, X } from "lucide-react";

export default function DisclaimerBanner() {
  const t = useTranslations("disclaimer");
  const tCommon = useTranslations("common");
  const tLanding = useTranslations("landing.v2");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="relative w-full bg-foreground text-background"
      role="region"
      aria-label="Service disclaimer"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-6 py-2 text-xs md:px-8 lg:px-12">
        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        <span className="truncate text-background/80">{t("banner")}</span>
        <a
          href="tel:988"
          className="inline-flex shrink-0 items-center gap-1.5 underline-offset-4 hover:underline"
        >
          <LifeBuoy className="h-3.5 w-3.5" strokeWidth={1.75} />
          {tLanding("crisisLink")}
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-auto shrink-0 rounded p-0.5 text-background/70 transition-colors hover:bg-background/10 hover:text-background"
          aria-label={tCommon("dismissDisclaimer")}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
