"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

/** Compact "MindEase is thinking..." pill rendered below the last message
 * while an @mention reply is being generated. The three dots animate via
 * a tailwind keyframe sequence. */
export function AiThinkingIndicator() {
  const t = useTranslations("groups");
  return (
    <div className="flex animate-fade-in items-center gap-3 px-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.06] px-3 py-2">
        <span className="text-[12.5px] font-medium text-primary">
          {t("aiThinking")}
        </span>
        <span className="inline-flex gap-0.5" aria-hidden>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}
