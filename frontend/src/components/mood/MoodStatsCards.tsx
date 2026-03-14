"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MoodStats } from "@/lib/types";

const MOOD_EMOJIS: Record<number, string> = { 1: "😢", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

function getMoodEmoji(avg: number | null): string {
  if (!avg) return "😐";
  return MOOD_EMOJIS[Math.round(avg)] ?? "😐";
}

const MOOD_TINTS: Record<number, string> = {
  1: "bg-red-50 dark:bg-red-950/30",
  2: "bg-orange-50 dark:bg-orange-950/30",
  3: "bg-yellow-50 dark:bg-yellow-950/30",
  4: "bg-green-50 dark:bg-green-950/30",
  5: "bg-emerald-50 dark:bg-emerald-950/30",
};

interface Props {
  stats: MoodStats;
}

export default function MoodStatsCards({ stats }: Props) {
  const t = useTranslations("mood");

  const avgRounded = stats.average_mood ? Math.round(stats.average_mood) : null;
  const avgTint = avgRounded ? MOOD_TINTS[avgRounded] : "bg-card";
  const weekProgress = Math.min((stats.entries_this_week / 7) * 100, 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Current Streak */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t("currentStreak")}</p>
        {stats.current_streak > 0 ? (
          <>
            <p className="text-3xl font-bold text-foreground leading-none mb-1">
              {stats.current_streak}
              <span className="ml-1 text-2xl">🔥</span>
            </p>
            <p className="text-xs text-muted-foreground">{t("consecutiveDays")}</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">{t("startStreak")}</p>
        )}
      </div>

      {/* Average Mood */}
      <div className={cn("rounded-2xl border border-border p-4 shadow-sm", avgTint)}>
        <p className="text-xs font-medium text-muted-foreground mb-2">{t("averageMood")}</p>
        <p className="text-4xl leading-none mb-1">{getMoodEmoji(stats.average_mood)}</p>
        {stats.average_mood !== null ? (
          <p className="text-sm font-semibold text-foreground">
            {stats.average_mood.toFixed(1)}{" "}
            <span className="text-xs font-normal text-muted-foreground">/ 5</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
      </div>

      {/* Total Entries */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t("totalEntries")}</p>
        <p className="text-3xl font-bold text-foreground leading-none mb-1">
          {stats.total_entries}
        </p>
        <p className="text-xs text-muted-foreground">{t("moodLogs")}</p>
      </div>

      {/* This Week */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-xs font-medium text-muted-foreground mb-2">{t("thisWeek")}</p>
        <p className="text-3xl font-bold text-foreground leading-none mb-2">
          {stats.entries_this_week}
          <span className="text-base font-normal text-muted-foreground"> / 7</span>
        </p>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${weekProgress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{t("daysLoggedThisWeek")}</p>
      </div>
    </div>
  );
}
