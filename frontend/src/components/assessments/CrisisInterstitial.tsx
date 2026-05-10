"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, LifeBuoy, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CrisisResources } from "@/lib/types";

interface Props {
  resources: CrisisResources;
  onContinue: () => void;
}

export function CrisisInterstitial({ resources, onContinue }: Props) {
  const t = useTranslations("assessments");
  const tCrisis = useTranslations("crisis");
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col justify-center px-4 py-10 md:px-8">
      <Card className="border-destructive/30 bg-destructive/[0.04] p-6 md:p-8">
        <div className="mb-5 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
            <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-serif text-xl text-foreground">
              {tCrisis("title")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("crisisNotice")}
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {resources.ethiopia?.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {tCrisis("ethiopia")}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {resources.ethiopia.map((r, i) => (
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
          {resources.international?.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {tCrisis("international")}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {resources.international.map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {r.url ? (
                      <>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-destructive" strokeWidth={1.75} />
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

        <Button onClick={onContinue} className="mt-6 w-full sm:w-auto">
          Continue Assessment
        </Button>
      </Card>
    </div>
  );
}
