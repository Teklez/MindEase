"use client";

import { useTranslations } from "next-intl";
import { Flame, TrendingUp } from "lucide-react";
import type { MoodStats } from "@/lib/types";
import { getMoodEmoji, getMoodLabel } from "@/lib/mood";

type Props = {
  stats: MoodStats;
};

export default function MoodStatsCards({ stats }: Props) {
  const t = useTranslations("mood");

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <Eyebrow>{t("currentStreak")}</Eyebrow>
        <Value>
          <Flame className="h-5 w-5 text-primary" strokeWidth={1.75} />
          <span className="font-serif text-3xl tracking-tight">{stats.current_streak}</span>
        </Value>
        <SubLabel>
          {stats.current_streak > 0 ? t("consecutiveDays") : t("startStreak")}
        </SubLabel>
      </Card>

      <Card>
        <Eyebrow>{t("longestStreak")}</Eyebrow>
        <Value>
          <TrendingUp className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <span className="font-serif text-3xl tracking-tight">{stats.longest_streak}</span>
        </Value>
        <SubLabel>{t("consecutiveDays")}</SubLabel>
      </Card>

      <Card>
        <Eyebrow>{t("averageMood")}</Eyebrow>
        <Value>
          {stats.average_mood !== null ? (
            <>
              <span className="text-2xl">{getMoodEmoji(stats.average_mood)}</span>
              <span className="font-serif text-3xl tracking-tight">
                {stats.average_mood.toFixed(1)}
              </span>
            </>
          ) : (
            <span className="font-serif text-3xl tracking-tight text-muted-foreground">—</span>
          )}
        </Value>
        <SubLabel>
          {stats.average_mood !== null
            ? getMoodLabel(stats.average_mood)
            : t("totalEntries")}
        </SubLabel>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm">{children}</div>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}
function Value({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex items-end gap-2">{children}</div>;
}
function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-muted-foreground">{children}</p>;
}
