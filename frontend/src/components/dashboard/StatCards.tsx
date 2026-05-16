"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  totalConversations: number;
  conversationsThisMonth: number;
  sessionsThisWeek: number;
  weekDelta: number;
  currentStreak: number;
  longestStreak: number;
};

type Trend = "up" | "flat" | "down";

function trendOf(n: number): Trend {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "flat";
}

const TREND_COLOR: Record<Trend, string> = {
  up: "text-primary",
  flat: "text-muted-foreground",
  down: "text-destructive",
};

const TREND_ICON: Record<Trend, typeof ArrowUp> = {
  up: ArrowUp,
  flat: ArrowRight,
  down: ArrowDown,
};

export default function StatCards({
  totalConversations,
  conversationsThisMonth,
  sessionsThisWeek,
  weekDelta,
  currentStreak,
  longestStreak,
}: Props) {
  const t = useTranslations("dashboard.v2.stats");

  const monthTrend = trendOf(conversationsThisMonth);
  const weekTrend = trendOf(weekDelta);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard>
        <Eyebrow>{t("totalConversations")}</Eyebrow>
        <Value>{totalConversations}</Value>
        <Delta trend={monthTrend}>
          {monthTrend === "up"
            ? t("deltaUp", { n: conversationsThisMonth })
            : monthTrend === "down"
              ? t("deltaUp", { n: conversationsThisMonth })
              : t("deltaFlat")}
        </Delta>
      </StatCard>

      <StatCard>
        <Eyebrow>{t("thisWeek")}</Eyebrow>
        <Value>{sessionsThisWeek}</Value>
        <Delta trend={weekTrend}>
          {weekTrend === "up"
            ? t("deltaWeekUp", { n: weekDelta })
            : weekTrend === "down"
              ? t("deltaWeekUp", { n: weekDelta })
              : t("deltaWeekFlat")}
        </Delta>
      </StatCard>

      <StatCard>
        <Eyebrow>{t("moodStreak")}</Eyebrow>
        <div className="mt-3 flex items-end gap-2 leading-none">
          <span className="font-serif text-[30px] font-[360] tracking-[-0.01em] text-foreground">
            {currentStreak}
          </span>
          <span className="text-[13px] text-muted-foreground">{t("streakSuffix")}</span>
        </div>
        <Delta trend="flat">{t("personalBest", { n: longestStreak })}</Delta>
      </StatCard>
    </div>
  );
}

function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft-sm transition-all hover:-translate-y-0.5 hover:shadow-soft-md">
      {children}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 font-serif text-[30px] font-[360] leading-none tracking-[-0.01em] text-foreground">
      {children}
    </p>
  );
}

function Delta({ trend, children }: { trend: Trend; children: React.ReactNode }) {
  const Icon = TREND_ICON[trend];
  return (
    <p
      className={cn(
        "mt-2 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.06em]",
        TREND_COLOR[trend],
      )}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      {children}
    </p>
  );
}
