"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import type { MoodTrend } from "@/lib/types";
import { getMoodColor, getMoodLabel } from "@/lib/mood";
import { cn } from "@/lib/utils";

type Props = {
  trends: MoodTrend[];
  streak: number;
  onPillClick?: (date: string) => void;
};

const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

export default function DashboardMoodWidget({ trends, streak, onPillClick }: Props) {
  const t = useTranslations("dashboard");
  const tMood = useTranslations("mood");

  const last7 = (() => {
    const out: Array<{ date: string; mood: number | null; label: string }> = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const found = trends.find((tr) => tr.date.slice(0, 10) === iso);
      out.push({
        date: iso,
        mood: found && found.entry_count > 0 ? found.average_mood : null,
        label: DAY_INITIALS[d.getDay()],
      });
    }
    return out;
  })();

  const hasAny = last7.some((d) => d.mood !== null);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl tracking-tight text-foreground">{t("weeklyMood")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {streak > 0 ? `${streak} ${tMood("consecutiveDays")}` : tMood("startStreak")}
          </p>
        </div>
        <Link
          href="/mood"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {tMood("viewFullTracker")} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2">
        {last7.map((day) => {
          const filled = day.mood !== null;
          const colorVar = filled ? getMoodColor(day.mood as number) : undefined;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onPillClick?.(day.date)}
              className={cn(
                "group flex flex-col items-center gap-2 rounded-2xl border border-transparent p-2 transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filled ? "hover:-translate-y-0.5" : "hover:bg-muted",
              )}
              aria-label={
                filled
                  ? `${day.date} — ${getMoodLabel(day.mood as number)}`
                  : `${day.date} — no entry`
              }
            >
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {day.label}
              </span>
              <span
                className={cn(
                  "block h-9 w-9 rounded-full transition-transform",
                  filled
                    ? "shadow-soft-sm group-hover:scale-110"
                    : "border border-dashed border-border bg-muted",
                )}
                style={filled ? { backgroundColor: colorVar } : undefined}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {!hasAny && (
        <p className="mt-4 text-xs text-muted-foreground">{t("noMoodData")}</p>
      )}
    </section>
  );
}
