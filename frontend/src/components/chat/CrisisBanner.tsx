"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, LifeBuoy, Phone, X } from "lucide-react";
import type { CrisisResources } from "@/lib/types";
import { Button } from "@/components/ui/button";

type CrisisBannerProps = {
  resources: CrisisResources;
  onDismiss: () => void;
};

export default function CrisisBanner({ resources, onDismiss }: CrisisBannerProps) {
  const t = useTranslations("crisis");
  const ethiopia = resources.ethiopia ?? [];
  const international = resources.international ?? [];

  return (
    <div
      role="alert"
      className="mb-4 animate-slide-down overflow-hidden rounded-2xl border border-destructive/30 bg-card shadow-soft"
    >
      <div className="flex items-start gap-3 border-b border-destructive/20 bg-destructive/[0.06] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
          <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base text-foreground">{t("title")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label={t("dismiss")}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>
      <div className="grid gap-4 p-4 text-sm sm:grid-cols-2">
        {ethiopia.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("ethiopia")}
            </p>
            <ul className="mt-2 space-y-1.5">
              {ethiopia.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-destructive" strokeWidth={1.75} />
                  <a
                    href={`tel:${r.phone.replace(/\D/g, "")}`}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {r.name}: {r.phone}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {international.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("international")}
            </p>
            <ul className="mt-2 space-y-1.5">
              {international.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  {r.url ? (
                    <>
                      <ExternalLink
                        className="h-3.5 w-3.5 shrink-0 text-destructive"
                        strokeWidth={1.75}
                      />
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline-offset-2 hover:underline"
                      >
                        {r.name}
                      </a>
                    </>
                  ) : (
                    <span className="text-foreground">
                      {r.name}
                      {r.info ? `: ${r.info}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
