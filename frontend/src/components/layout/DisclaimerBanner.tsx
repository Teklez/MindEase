"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function DisclaimerBanner() {
  const t = useTranslations("disclaimer");
  const tCommon = useTranslations("common");
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => setDismissed(true);

  if (dismissed) return null;

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 h-9 text-xs sm:text-sm bg-amber-50 text-amber-900 border-b border-amber-200/60"
      role="banner"
    >
      <p className="flex-1 text-center sm:text-left min-h-0">
        {t("banner")}
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 p-1.5 rounded hover:bg-amber-200/60 transition-colors"
        aria-label={tCommon("dismissDisclaimer")}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
