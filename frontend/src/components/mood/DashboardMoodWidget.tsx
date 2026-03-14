"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MoodTrend } from "@/lib/types";

const MOOD_COLORS: Record<number, string> = {
  1: "#EF4444",
  2: "#F97316",
  3: "#EAB308",
  4: "#22C55E",
  5: "#10B981",
};

interface Props {
  trends: MoodTrend[];
  streak: number;
}

export default function DashboardMoodWidget({ trends, streak }: Props) {
  const t = useTranslations("mood");
  const last7 = trends.slice(-7);
  const hasAnyData = last7.some((d) => d.entry_count > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {streak > 0 ? (
            <span className="text-sm font-semibold text-foreground">
              {streak} <span className="text-base">🔥</span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          <span className="text-xs text-muted-foreground">{t("streak")}</span>
        </div>
        <Link
          href="/mood"
          className="text-xs text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {t("viewFullTracker")} →
        </Link>
      </div>

      {/* Mini 7-day bar sparkline */}
      <div className="flex items-end gap-0.5 h-9">
        {last7.map((day, i) => {
          const hasEntry = day.entry_count > 0;
          const heightPct = hasEntry ? Math.max((day.average_mood / 5) * 100, 20) : 12;
          const color = hasEntry ? MOOD_COLORS[Math.round(day.average_mood)] : undefined;
          return (
            <div key={i} className="flex-1 flex items-end h-full">
              <div
                className="w-full rounded-sm transition-all duration-500"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: color ?? "currentColor",
                  opacity: hasEntry ? 0.8 : 0.15,
                }}
              />
            </div>
          );
        })}
      </div>

      {!hasAnyData && (
        <p className="text-xs text-muted-foreground mt-2 text-center">{t("noTrendData")}</p>
      )}
    </div>
  );
}
