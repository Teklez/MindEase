"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { MoodStats } from "@/lib/types";
import { getMoodColor, getMoodEmoji } from "@/lib/mood";
import { useMoodLabels } from "@/hooks/useMoodLabels";

type Props = {
  stats: MoodStats;
};

export default function MoodDistribution({ stats }: Props) {
  const t = useTranslations("mood");
  const { getMoodLabel } = useMoodLabels();
  const total = stats.total_entries;
  if (total === 0) return null;

  const data = [5, 4, 3, 2, 1].map((level) => ({
    level,
    name: getMoodLabel(level),
    value: stats.mood_distribution[String(level)] ?? 0,
    color: getMoodColor(level),
  }));

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
      <h3 className="font-serif text-xl tracking-tight text-foreground">{t("distribution")}</h3>
      <div className="mt-4 grid items-center gap-6 md:grid-cols-2">
        <div className="relative h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                stroke="none"
                isAnimationActive
              >
                {data.map((d) => (
                  <Cell key={d.level} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: "13px",
                  color: "var(--foreground)",
                }}
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value ?? 0);
                  return [`${n} (${((n / total) * 100).toFixed(0)}%)`, ""];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="font-serif text-3xl tracking-tight text-foreground">{total}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("totalEntries")}
              </p>
            </div>
          </div>
        </div>

        <ul className="space-y-2.5">
          {data.map((d) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <li key={d.level} className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: d.color }}
                  aria-hidden
                />
                <span className="text-lg leading-none">{getMoodEmoji(d.level)}</span>
                <span className="flex-1 text-sm text-foreground">{d.name}</span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {d.value} · {pct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
