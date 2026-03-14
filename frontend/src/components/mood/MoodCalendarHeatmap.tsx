"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getMoodCalendar } from "@/lib/api";
import type { MoodDayAggregate } from "@/lib/types";
import { cn } from "@/lib/utils";

// Hex colors for mood levels
const MOOD_COLORS: Record<number, string> = {
  0: "",
  1: "#EF4444",
  2: "#F97316",
  3: "#EAB308",
  4: "#22C55E",
  5: "#10B981",
};

function getMoodColor(avgMood: number, entryCount: number): string {
  if (entryCount === 0) return "";
  return MOOD_COLORS[Math.round(avgMood)] ?? MOOD_COLORS[3];
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildCalendarWeeks(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // Adjust Sunday (0) → 7, then -1 for 0-indexed Mon-first
  const startDow = firstDay.getDay();
  const offset = startDow === 0 ? 6 : startDow - 1;

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const MOOD_EMOJIS: Record<number, string> = { 1: "😢", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

export default function MoodCalendarHeatmap() {
  const t = useTranslations("mood");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [dayData, setDayData] = useState<Map<string, MoodDayAggregate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<MoodDayAggregate | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedDay(null);
    const res = await getMoodCalendar(year, month);
    setLoading(false);
    if (res.ok) {
      const map = new Map<string, MoodDayAggregate>();
      res.data.forEach((d) => map.set(d.date, d));
      setDayData(map);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const isFutureMonth =
    year > today.getFullYear() ||
    (year === today.getFullYear() && month > today.getMonth() + 1);

  const weeks = buildCalendarWeeks(year, month);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-foreground">{t("calendar")}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isFutureMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground py-1">{d}</div>
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;

                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const agg = dayData.get(dateStr);
                  const hasEntry = (agg?.entry_count ?? 0) > 0;
                  const isToday = dateStr === todayStr;
                  const isFuture = dateStr > todayStr;
                  const color = agg && hasEntry ? getMoodColor(agg.average_mood, agg.entry_count) : "";

                  return (
                    <button
                      key={di}
                      onClick={() => !isFuture && agg && setSelectedDay(agg.date === selectedDay?.date ? null : agg)}
                      disabled={isFuture || !hasEntry}
                      className={cn(
                        "aspect-square rounded-lg text-xs font-medium transition-all duration-150 relative",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isFuture && "opacity-20 cursor-not-allowed",
                        !hasEntry && !isFuture && "bg-muted/50 text-muted-foreground cursor-default",
                        hasEntry && !isFuture && "cursor-pointer hover:brightness-90 hover:scale-105",
                        isToday && "ring-2 ring-primary ring-offset-1",
                        selectedDay?.date === dateStr && "ring-2 ring-foreground ring-offset-1"
                      )}
                      style={color ? { backgroundColor: color, color: "#fff" } : undefined}
                      aria-label={`${dateStr}${hasEntry ? `: mood ${agg?.average_mood?.toFixed(1)}` : ""}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Day detail popup */}
          {selectedDay && (
            <div className="mt-4 p-4 rounded-xl bg-muted/50 border border-border animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">
                  {new Date(selectedDay.date + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </p>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {selectedDay.entries.map((entry) => (
                  <div key={entry.entry_id} className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">
                      {MOOD_EMOJIS[entry.mood_level]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatEntryTime(entry.created_at)}</p>
                      {entry.note && (
                        <p className="text-xs text-foreground mt-0.5 leading-snug">{entry.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Mood:</span>
            {[1, 2, 3, 4, 5].map((level) => (
              <div key={level} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: MOOD_COLORS[level] }} />
                <span className="text-xs text-muted-foreground">{MOOD_EMOJIS[level]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
