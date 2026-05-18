"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getMoodTrends } from "@/lib/api";
import type { MoodTrend } from "@/lib/types";
import { getMoodEmoji } from "@/lib/mood";
import { useMoodLabels } from "@/hooks/useMoodLabels";
import { cn } from "@/lib/utils";

function formatXDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatXDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function MoodYTick(props: { x?: number | string; y?: number | string; payload?: { value: number } }) {
  const { x, y, payload } = props;
  if (!payload || x === undefined || y === undefined) return null;
  const xn = typeof x === "number" ? x : Number(x);
  return (
    <text
      x={xn - 6}
      y={y}
      textAnchor="end"
      dominantBaseline="middle"
      fontSize={14}
      style={{ userSelect: "none" }}
    >
      {getMoodEmoji(payload.value)}
    </text>
  );
}

function MoodTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: MoodTrend }[];
  label?: string;
}) {
  const { getMoodLabel } = useMoodLabels();
  if (!active || !payload?.length || !payload[0].value) return null;
  const avg = payload[0].value;
  const entry = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-soft-md">
      <p className="mb-1 font-medium text-foreground">{label && formatXDate(label)}</p>
      <p className="text-foreground">
        {getMoodEmoji(avg)} {avg.toFixed(1)} — {getMoodLabel(avg)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {entry.entry_count} {entry.entry_count === 1 ? "entry" : "entries"}
      </p>
    </div>
  );
}

export default function MoodLineChart() {
  const t = useTranslations("mood");
  const [selectedDays, setSelectedDays] = useState(30);
  const [data, setData] = useState<MoodTrend[]>([]);
  const [loading, setLoading] = useState(true);

  const RANGES = [
    { label: t("days7"), days: 7 as const },
    { label: t("days30"), days: 30 as const },
    { label: t("days90"), days: 90 as const },
    { label: t("allTime"), days: 365 as const },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await getMoodTrends(selectedDays);
    setLoading(false);
    if (res.ok) setData(res.data);
  }, [selectedDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data.map((d) => ({
    ...d,
    average_mood: d.entry_count > 0 ? d.average_mood : null,
  }));
  const hasData = chartData.some((d) => d.average_mood !== null);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-serif text-xl tracking-tight text-foreground">{t("trends")}</h3>
        <div className="flex gap-1 rounded-full border border-border bg-background p-1">
          {RANGES.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider transition-all",
                selectedDays === days
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[260px] items-center justify-center">
          <div className="flex gap-1">
            {[0, 150, 300].map((delay, i) => (
              <span
                key={i}
                className="h-2 w-2 animate-bounce-dot rounded-full bg-primary"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      ) : !hasData ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-3">
          <p className="max-w-[260px] text-center text-sm text-muted-foreground">
            {t("noTrendData")}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="moodAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
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
            <Tooltip content={(props) => <MoodTooltip {...(props as unknown as Parameters<typeof MoodTooltip>[0])} />} />
            <Area
              type="monotone"
              dataKey="average_mood"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#moodAreaGrad)"
              dot={{ r: 3, stroke: "var(--primary)", strokeWidth: 1.5, fill: "var(--card)" }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: "var(--primary)" }}
              connectNulls={false}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
