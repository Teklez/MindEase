"use client";

import { useTranslations } from "next-intl";
import { Activity, MessageCircle, Smile, Wind } from "lucide-react";

const PROMPT_KEYS = ["anxious", "stress", "talk", "breathing"] as const;
const ICONS = {
  anxious: MessageCircle,
  stress: Activity,
  talk: Smile,
  breathing: Wind,
} as const;

type StarterPromptsProps = {
  onSelect: (prompt: string) => void;
};

export default function StarterPrompts({ onSelect }: StarterPromptsProps) {
  const t = useTranslations("chat.v2.starters");

  return (
    <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PROMPT_KEYS.map((key) => {
        const Icon = ICONS[key];
        const title = t(`${key}.title`);
        const sub = t(`${key}.sub`);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(title)}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary transition-colors">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-foreground">{title}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
