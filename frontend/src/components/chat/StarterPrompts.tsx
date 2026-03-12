"use client";

import { useTranslations } from "next-intl";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

const PROMPT_KEYS = ["anxious", "stress", "talk", "breathing"] as const;
const EMOJIS = ["💭", "😤", "💬", "🌬️"] as const;

type StarterPromptsProps = {
  onSelect: (prompt: string) => void;
  /** Show logo above the heading. Default true. */
  showLogo?: boolean;
  /** Override default heading. */
  heading?: string;
  /** Override default subtitle. */
  subtitle?: string;
};

export default function StarterPrompts({
  onSelect,
  showLogo = true,
  heading,
  subtitle,
}: StarterPromptsProps) {
  const t = useTranslations("chat");
  const headingText = heading ?? t("welcomeMessage");
  const subtitleText = subtitle ?? t("welcomeSubtitle");
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="flex max-w-md flex-col items-center text-center">
        {showLogo && (
          <div className="mb-6">
            <Logo size="lg" asLink={false} />
          </div>
        )}
        <h2 className="text-xl font-semibold text-foreground">{headingText}</h2>
        <p className="mt-2 text-muted-foreground">{subtitleText}</p>
        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {PROMPT_KEYS.map((key, i) => {
            const text = t(`starters.${key}`);
            return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(text)}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm",
                "transition-all hover:scale-[1.02] hover:border-primary/40 hover:bg-primary/5",
                "focus:outline-none focus:ring-2 focus:ring-primary/30"
              )}
              >
              <span className="text-lg" aria-hidden>
                {EMOJIS[i]}
              </span>
              <span className="text-foreground">{text}</span>
            </button>
          );
          })}
        </div>
      </div>
    </div>
  );
}
