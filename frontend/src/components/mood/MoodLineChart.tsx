"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getMoodTrends } from "@/lib/api";
import type { MoodTrend } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOOD_EMOJIS: Record<number, string> = { 1: "😢", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

function formatXDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatXDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

// Custom Y-axis tick with emoji
function MoodYTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: number } }) {
  if (!payload || !x || !y) return null;
  const emoji = MOOD_EMOJIS[payload.value];
  if (!emoji) return null;
  return (
    <text x={x - 4} y={y} textAnchor="end" dominantBaseline="middle" fontSize={14} style={{ userSelect: "none" }}>
      {emoji}
    </text>
  );
}

// Custom tooltip — receives moodLabels map so it can use translated strings
function MoodTooltip({ active, payload, label, moodLabels }: {
  active?: boolean;
  payload?: { value: number; payload: MoodTrend }[];
  label?: string;
  moodLabels: Record<number, string>;
}) {
  if (!active || !payload?.length || !payload[0].value) return null;
  const avg = payload[0].value;
  const entry = payload[0].payload;
  const rounded = Math.round(avg);
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label && formatXDate(label)}</p>
      <p className="text-foreground">
        {MOOD_EMOJIS[rounded]} {avg.toFixed(1)} — {moodLabels[rounded]}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {entry.entry_count} {entry.entry_count === 1 ? "entry" : "entries"}
      </p>
    </div>
  );
}

export default function MoodLineChart() {
  const t = useTranslations("mood");
  const [selectedDays, setSelectedDays] = useState(30);

  const RANGES = [
    { label: t("days7"), days: 7 as const },
    { label: t("days30"), days: 30 as const },
    { label: t("days90"), days: 90 as const },
    { label: t("allTime"), days: 365 as const },
  ];
  const moodLabels: Record<number, string> = {
    1: t("veryBad"), 2: t("bad"), 3: t("neutral"), 4: t("good"), 5: t("veryGood"),
  };
  const [data, setData] = useState<MoodTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getMoodTrends(selectedDays);
    setLoading(false);
    if (res.ok) setData(res.data);
  }, [selectedDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter to chart-worthy data: replace 0-entry days with null average
  const chartData = data.map((d) => ({
    ...d,
    average_mood: d.entry_count > 0 ? d.average_mood : null,
  }));

  const hasData = chartData.some((d) => d.average_mood !== null);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      {/* Range selector */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-foreground">{t("trends")}</h3>
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted">
          {RANGES.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-all duration-150",
                selectedDays === days
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[250px] md:h-[300px] flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      ) : !hasData ? (
        <div className="h-[250px] md:h-[300px] flex flex-col items-center justify-center gap-3">
          <span className="text-4xl">📈</span>
          <p className="text-sm text-muted-foreground text-center max-w-[240px]">
            {t("noTrendData")}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={typeof window !== "undefined" && window.innerWidth < 768 ? 250 : 300}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="moodLineGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="50%" stopColor="#EAB308" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
              <linearGradient id="moodAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                <stop offset="50%" stopColor="#EAB308" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} />
            <XAxis
              dataKey="date"
              tickFormatter={selectedDays > 30 ? formatXDateShort : formatXDate}
              tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }}
              tickLine={false}
              axisLine={false}
              interval={selectedDays <= 7 ? 0 : selectedDays <= 30 ? 4 : 13}
            />
            <YAxis
              domain={[0.5, 5.5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={(props) => <MoodYTick {...props} />}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip content={(props) => <MoodTooltip {...(props as Parameters<typeof MoodTooltip>[0])} moodLabels={moodLabels} />} />
            <Area
              type="monotone"
              dataKey="average_mood"
              stroke="url(#moodLineGrad)"
              fill="url(#moodAreaGrad)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              connectNulls={false}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
