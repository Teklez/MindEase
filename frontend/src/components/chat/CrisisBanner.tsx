"use client";

import { useTranslations } from "next-intl";
import type { CrisisResources } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type CrisisBannerProps = {
  resources: CrisisResources;
  onDismiss: () => void;
};

export default function CrisisBanner({ resources, onDismiss }: CrisisBannerProps) {
  const t = useTranslations("crisis");
  const ethiopia = resources.ethiopia ?? [];
  const international = resources.international ?? [];

  return (
    <Card
      className={cn(
        "animate-slide-down mb-4 border-destructive/50 bg-gradient-to-br from-destructive to-destructive/90 text-destructive-foreground shadow-lg"
      )}
      role="alert"
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3 min-w-0 flex-1">
            <AlertTriangle className="h-6 w-6 shrink-0 opacity-90" aria-hidden />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold">{t("title")}</h3>
              <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                {ethiopia.length > 0 && (
                  <div>
                    <p className="font-medium opacity-95">{t("ethiopia")}</p>
                    <ul className="mt-1.5 space-y-1">
                      {ethiopia.map((r, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          <a
                            href={`tel:${r.phone.replace(/\D/g, "")}`}
                            className="underline hover:no-underline"
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
                    <p className="font-medium opacity-95">{t("international")}</p>
                    <ul className="mt-1.5 space-y-1">
                      {international.map((r, i) => (
                        <li key={i} className="flex items-center gap-2">
                          {r.url ? (
                            <>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:no-underline"
                              >
                                {r.name}
                              </a>
                            </>
                          ) : (
                            <span>{r.name}{r.info ? `: ${r.info}` : ""}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 border-white/50 bg-transparent text-white hover:bg-white/20 hover:text-white"
            onClick={onDismiss}
          >
            {t("dismiss")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
