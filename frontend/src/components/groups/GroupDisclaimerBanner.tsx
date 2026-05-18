"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, X } from "lucide-react";

const STORAGE_KEY = "mindease-group-disclaimer-dismissed";

/** Subtle pinned banner reminding members that this is peer support, not
 * professional therapy. Dismissible per browser session. */
export function GroupDisclaimerBanner() {
  const t = useTranslations("groups.disclaimer");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(STORAGE_KEY) === "1";
    setVisible(!dismissed);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-2">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 text-[12px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <p className="flex-1 leading-snug">{t("body")}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
