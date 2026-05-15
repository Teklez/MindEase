"use client";

import { useTranslations } from "next-intl";
import {
  ArrowRight,
  LifeBuoy,
  MessageSquare,
  Phone,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCrisisResources } from "@/lib/crisis-resources";
import { cn } from "@/lib/utils";

interface Props {
  lang: string;
  onContinue: () => void;
  onComeBackLater: () => void;
}

/**
 * Trauma-informed pause shown when the user answers the crisis question
 * above threshold. Clay-tinted (not red — "we're paying attention," not
 * "you're broken"). Both buttons are valid exits; the answer has already
 * been logged before this screen renders.
 */
export function CrisisInterstitial({ lang, onContinue, onComeBackLater }: Props) {
  const t = useTranslations("assessments.crisis");
  const resources = getCrisisResources(lang);

  const headline = t("headline");
  const emphasis = t("headlineEmphasis");
  const [before, after] = splitOnce(headline, emphasis);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[color-mix(in_oklab,var(--accent)_10%,var(--background))] px-4 py-10">
      <div className="w-full max-w-xl rounded-lg border border-clay/30 bg-background p-7 shadow-soft-md md:p-9">
        <div
          className="grid h-14 w-14 place-items-center rounded-full bg-clay-soft text-clay-deep"
          aria-hidden
        >
          <LifeBuoy className="h-6 w-6" strokeWidth={1.7} />
        </div>

        <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-clay-deep">
          — {t("eyebrow")}
        </p>

        <h2 className="mt-2 font-serif text-[26px] leading-snug tracking-tight text-foreground md:text-[28px]">
          {before}
          <em className="text-clay-deep">{emphasis}</em>
          {after}
        </h2>

        <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
          {t("body")}
        </p>

        <ul className="mt-6 flex flex-col gap-1">
          {resources.map((r) => {
            const Icon =
              r.type === "phone"
                ? Phone
                : r.type === "sms"
                  ? MessageSquare
                  : ExternalLink;
            return (
              <li key={r.id}>
                <a
                  href={r.href}
                  target={r.type === "url" ? "_blank" : undefined}
                  rel={r.type === "url" ? "noopener noreferrer" : undefined}
                  className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-secondary/60"
                >
                  <span
                    className="grid h-8 w-8 place-items-center rounded-md bg-clay-soft text-clay-deep"
                    aria-hidden
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif text-[14.5px] italic leading-snug text-foreground">
                      {r.name}
                    </span>
                    <span className="block font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      {r.contact}
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onComeBackLater}
            className={cn("min-h-[44px]")}
          >
            {t("comeBack")}
          </Button>
          <Button
            type="button"
            onClick={onContinue}
            className={cn(
              "min-h-[44px] bg-clay-deep text-background hover:bg-clay-deep/90",
            )}
          >
            {t("continueCheckIn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  if (i === -1) return [s, ""];
  return [s.slice(0, i), s.slice(i + sep.length)];
}
