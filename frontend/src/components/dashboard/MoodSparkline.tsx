"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { MoodTrend } from "@/lib/types";

type Props = {
  trends: MoodTrend[];
  streak: number;
  averageMood: number | null;
};

// Tailwind's bg-primary/X opacity utility doesn't generate CSS when --primary
// is a full oklch(...) function value (it can't compute the alpha at build time),
// so we render the bar tint via inline color-mix() which works at runtime.
const SHADE_STYLES: Array<{ backgroundColor: string }> = [
  { backgroundColor: "var(--muted)" },
  { backgroundColor: "color-mix(in oklch, var(--primary) 30%, transparent)" },
  { backgroundColor: "color-mix(in oklch, var(--primary) 45%, transparent)" },
  { backgroundColor: "color-mix(in oklch, var(--primary) 60%, transparent)" },
  { backgroundColor: "color-mix(in oklch, var(--primary) 80%, transparent)" },
  { backgroundColor: "var(--primary)" },
];

const DAY_LETTERS_EN = ["S", "M", "T", "W", "T", "F", "S"] as const;

function shadeFor(value: number | null): { backgroundColor: string } {
  if (value === null || value <= 0) return SHADE_STYLES[0];
  if (value < 1.5) return SHADE_STYLES[1];
  if (value < 2.5) return SHADE_STYLES[2];
  if (value < 3.5) return SHADE_STYLES[3];
  if (value < 4.5) return SHADE_STYLES[4];
  return SHADE_STYLES[5];
}

function buildSevenDays(trends: MoodTrend[]): Array<{ date: Date; value: number | null }> {
  const byDate = new Map<string, number>();
  for (const trend of trends) {
    byDate.set(trend.date.slice(0, 10), trend.average_mood);
  }
  const out: Array<{ date: Date; value: number | null }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const value = byDate.get(key);
    out.push({ date: d, value: value ?? null });
  }
  return out;
}

function trendFor(values: Array<number | null>): "up" | "flat" | "down" {
  const filled = values.filter((v): v is number => v !== null && v > 0);
  if (filled.length < 2) return "flat";
  const first = filled.slice(0, Math.ceil(filled.length / 2)).reduce((a, b) => a + b, 0) /
    Math.ceil(filled.length / 2);
  const second = filled.slice(Math.ceil(filled.length / 2)).reduce((a, b) => a + b, 0) /
    (filled.length - Math.ceil(filled.length / 2));
  if (second - first > 0.2) return "up";
  if (first - second > 0.2) return "down";
  return "flat";
}

export default function MoodSparkline({ trends, streak, averageMood }: Props) {
  const t = useTranslations("dashboard.v2.sparkline");
  const days = buildSevenDays(trends);
  const trend = trendFor(days.map((d) => d.value));

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-start justify-between px-6 pb-2 pt-5">
        <h2 className="font-serif text-[20px] font-[360] tracking-[-0.01em] text-foreground">
          {t("title")}
        </h2>
        <div className="mt-1 flex flex-col items-end gap-1.5 text-right">
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-primary">
            {t("streak", { n: streak })}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {t("avg", { value: (averageMood ?? 0).toFixed(1) })}
          </span>
        </div>
      </header>

      <div className="px-6 pb-5 pt-2">
        <div className="flex h-28 items-end gap-1.5">
          {days.map((d, i) => {
            const value = d.value ?? 0;
            const heightPct = value > 0 ? value * 16 + 12 : 12;
            return (
              <div
                key={i}
                style={{ height: `${heightPct}%`, ...shadeFor(d.value) }}
                className="flex-1 rounded"
                aria-label={
                  d.value
                    ? `${d.date.toDateString()}: ${d.value.toFixed(1)}/5`
                    : `${d.date.toDateString()}: no entry`
                }
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground/80">
          {days.map((d, i) => (
            <span key={i} className="flex-1 text-center">
              {DAY_LETTERS_EN[d.date.getDay()]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-3.5">
        <span className="text-[13px] text-muted-foreground">{t(`trend${trend.charAt(0).toUpperCase()}${trend.slice(1)}` as "trendUp" | "trendFlat" | "trendDown")}</span>
        <Link
          href="/mood"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary transition-colors hover:text-foreground"
        >
          {t("openTracker")}
        </Link>
      </div>
    </section>
  );
}
