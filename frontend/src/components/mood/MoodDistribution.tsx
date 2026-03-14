"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MoodStats } from "@/lib/types";

const MOOD_CONFIG = [
  { level: 5, emoji: "😄", label: "veryGood", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  { level: 4, emoji: "🙂", label: "good", bar: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  { level: 3, emoji: "😐", label: "neutral", bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
  { level: 2, emoji: "😕", label: "bad", bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  { level: 1, emoji: "😢", label: "veryBad", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
] as const;

interface Props {
  stats: MoodStats;
}

export default function MoodDistribution({ stats }: Props) {
  const t = useTranslations("mood");
  const total = stats.total_entries;

  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">{t("distribution")}</h3>
      <div className="space-y-2.5">
        {MOOD_CONFIG.map(({ level, emoji, label, bar, text }) => {
          const count = stats.mood_distribution[String(level)] ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={level} className="flex items-center gap-3">
              <span className="text-lg leading-none w-6 shrink-0">{emoji}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn("text-xs font-medium tabular-nums w-8 shrink-0 text-right", text)}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0 text-right">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
