"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Flame, Smile } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { getMoodEmoji, getMoodLabel } from "@/lib/mood";
import { cn } from "@/lib/utils";

type Props = {
  currentStreak: number;
  longestStreak: number;
  averageMood: number | null;
  moodDelta: number | null;
  sessionsThisWeek: number;
  sparkline: Array<{ value: number }>;
};

export default function StatCards({
  currentStreak,
  longestStreak,
  averageMood,
  moodDelta,
  sessionsThisWeek,
  sparkline,
}: Props) {
  const t = useTranslations("dashboard");

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <Eyebrow>{t("streak")}</Eyebrow>
        <Value>
          <Flame className="h-6 w-6 text-primary" strokeWidth={1.75} />
          <span className="font-serif text-4xl tracking-tight">{currentStreak}</span>
          <span className="text-base text-muted-foreground">{currentStreak === 1 ? t("daySingular") : t("days")}</span>
        </Value>
        <SubLabel>{t("longest", { days: longestStreak })}</SubLabel>
      </Card>

      <Card>
        <Eyebrow>{t("averageMood")}</Eyebrow>
        <Value>
          {averageMood !== null ? (
            <>
              <span className="text-3xl">{getMoodEmoji(averageMood)}</span>
              <span className="font-serif text-3xl tracking-tight">{averageMood.toFixed(1)}</span>
              {moodDelta !== null && moodDelta !== 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
                    moodDelta > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                  )}
                >
                  {moodDelta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(moodDelta).toFixed(1)}
                </span>
              )}
            </>
          ) : (
            <>
              <Smile className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
              <span className="font-serif text-3xl text-muted-foreground">—</span>
            </>
          )}
        </Value>
        <SubLabel>{averageMood !== null ? getMoodLabel(averageMood) : "Last 7 days"}</SubLabel>
      </Card>

      <Card>
        <Eyebrow>{t("thisWeek")}</Eyebrow>
        <div className="mt-3 flex items-end justify-between gap-3">
          <span className="font-serif text-4xl tracking-tight">{sessionsThisWeek}</span>
          <div className="h-10 w-24">
            {sparkline.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkline} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-md bg-muted" />
            )}
          </div>
        </div>
        <SubLabel>Last 7 days</SubLabel>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm transition-all hover:-translate-y-0.5 hover:shadow-soft-md">
      {children}
    </div>
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
