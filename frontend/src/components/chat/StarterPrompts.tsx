"use client";

import { useTranslations } from "next-intl";
import { Sparkles, MessageCircle, Heart, Wind } from "lucide-react";

const PROMPT_KEYS = ["anxious", "stress", "talk", "breathing"] as const;
const ICONS = [Sparkles, MessageCircle, Heart, Wind];

type StarterPromptsProps = {
  onSelect: (prompt: string) => void;
  showLogo?: boolean;
  heading?: string;
  subtitle?: string;
};

export default function StarterPrompts({
  onSelect,
  heading,
  subtitle,
}: StarterPromptsProps) {
  const t = useTranslations("chat");
  const headingText = heading ?? t("emptyHeadline");
  const subtitleText = subtitle ?? t("emptySubtitle");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <h2 className="font-serif text-[28px] leading-[1.18] tracking-tight text-foreground sm:text-[34px]">
          {headingText}
        </h2>
        <p className="mt-3 max-w-md text-[15px] text-muted-foreground">{subtitleText}</p>

        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {PROMPT_KEYS.map((key, i) => {
            const text = t(`starters.${key}`);
            const Icon = ICONS[i] ?? Sparkles;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(text)}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left text-sm text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-[14px]">{text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
