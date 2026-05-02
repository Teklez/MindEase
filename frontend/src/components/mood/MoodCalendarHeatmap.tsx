"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getMoodCalendar } from "@/lib/api";
import type { MoodDayAggregate } from "@/lib/types";
import { getMoodColor, getMoodEmoji } from "@/lib/mood";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function buildCalendarWeeks(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay();
  const offset = startDow === 0 ? 6 : startDow - 1;
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function formatEntryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function MoodCalendarHeatmap() {
  const t = useTranslations("mood");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  }

  const isFutureMonth =
    year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);
  const weeks = buildCalendarWeeks(year, month);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-serif text-xl tracking-tight text-foreground">{t("calendar")}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-foreground">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={isFutureMonth}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="py-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5">
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const agg = dayData.get(dateStr);
                  const hasEntry = (agg?.entry_count ?? 0) > 0;
                  const isToday = dateStr === todayStr;
                  const isFuture = dateStr > todayStr;
                  return (
                    <button
                      key={di}
                      onClick={() => !isFuture && agg && setSelectedDay(selectedDay?.date === agg.date ? null : agg)}
                      disabled={isFuture || !hasEntry}
                      className={cn(
                        "relative aspect-square rounded-lg text-xs font-medium transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isFuture && "cursor-not-allowed opacity-30",
                        !hasEntry && !isFuture && "border border-dashed border-border bg-transparent text-muted-foreground",
                        hasEntry && !isFuture && "text-white shadow-soft-sm hover:scale-105",
                        isToday && "ring-2 ring-foreground/30 ring-offset-1 ring-offset-card",
                        selectedDay?.date === dateStr && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                      )}
                      style={
                        hasEntry && agg ? { backgroundColor: getMoodColor(agg.average_mood) } : undefined
                      }
                      aria-label={`${dateStr}${hasEntry ? `: mood ${agg?.average_mood?.toFixed(1)}` : ""}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {selectedDay && (
            <div className="mt-5 animate-fade-in rounded-xl border border-border bg-muted/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {new Date(selectedDay.date + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <div className="space-y-2">
                {selectedDay.entries.map((entry) => (
                  <div key={entry.entry_id} className="flex items-start gap-2">
                    <span className="mt-0.5 text-lg leading-none">{getMoodEmoji(entry.mood_level)}</span>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{formatEntryTime(entry.created_at)}</p>
                      {entry.note && (
                        <p className="mt-0.5 text-xs leading-snug text-foreground">{entry.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Mood:</span>
            {[1, 2, 3, 4, 5].map((level) => (
              <div key={level} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: getMoodColor(level) }}
                />
                <span className="text-[11px] text-muted-foreground">{getMoodEmoji(level)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
