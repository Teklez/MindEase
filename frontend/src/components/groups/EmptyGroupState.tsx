"use client";

import { useTranslations } from "next-intl";
import { Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED = [
  "Hi everyone! 👋",
  "Glad to find this group",
  "How is everyone doing today?",
];

interface Props {
  onPick: (text: string) => void;
}

/** Shown when a group has no user messages yet (system join messages don't
 * count). Offers tap-to-send conversation starters to get things going. */
export function EmptyGroupState({ onPick }: Props) {
  const t = useTranslations("groups");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Wand2 className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div>
        <p className="font-serif text-lg text-foreground">
          Be the first to say hello!
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          A simple greeting goes a long way. Pick a starter or write your own.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className={cn(
              "rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px]",
              "text-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04]",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" strokeWidth={2} />
        {t("aiTip")}
      </p>
    </div>
  );
}
