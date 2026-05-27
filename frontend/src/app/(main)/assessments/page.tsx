"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  Brain,
  ChevronRight,
  HeartPulse,
  Activity,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { getAssessmentHistory, listAssessments } from "@/lib/api";
import type {
  AssessmentHistory,
  AssessmentHistoryItem,
  AssessmentListItem,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreTrendMini } from "@/components/assessments/ScoreTrendMini";
import { toast } from "@/hooks/use-toast";
import {
  instrumentCode,
  levelToIndex,
} from "@/lib/assessment-level";
import { useLevelLabel } from "@/hooks/useLevelLabel";
import { cn } from "@/lib/utils";

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "am" ? "am-ET" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function useRelativeDay() {
  const tList = useTranslations("assessments.list");
  return (iso: string): string => {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / (24 * 3600 * 1000));
    if (days === 0) return tList("relativeToday");
    if (days === 1) return tList("relativeYesterday");
    if (days < 7) return tList("relativeDaysAgo", { n: days });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
}

interface DueInfo {
  due: boolean;
  date: Date | null;
}

function readDue(assessmentType: string): DueInfo {
  if (typeof window === "undefined") return { due: false, date: null };
  try {
    const raw = localStorage.getItem(
      `mindease.assessment.due.${assessmentType}`,
    );
    if (!raw) return { due: false, date: null };
    const date = new Date(raw);
    return { due: date.getTime() <= Date.now(), date };
  } catch {
    return { due: false, date: null };
  }
}

export default function AssessmentsPage() {
  const t = useTranslations("assessments");
  const tSafety = useTranslations("assessments.safety");
  const tStats = useTranslations("assessments.stats");
  const tAvailable = useTranslations("assessments.available");
  const tHist = useTranslations("assessments.historyPanel");
  const tList = useTranslations("assessments.list");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<AssessmentListItem[]>([]);
  const [history, setHistory] = useState<AssessmentHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([listAssessments(), getAssessmentHistory()]).then(
      ([listRes, histRes]) => {
        if (listRes.ok) setItems(listRes.data);
        if (histRes.ok) setHistory(histRes.data);
        setIsLoading(false);
      },
    );
  }, []);

  const trendsByType = useMemo(() => history?.score_trends ?? {}, [history]);

  // Stats
  const toolCount = items.length;
  const totalTaken = history?.total ?? 0;
  const thisMonthCount = useMemo(() => {
    if (!history) return 0;
    const now = new Date();
    return history.history.filter((h) => {
      const d = new Date(h.completed_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [history]);

  // Headline splits
  const headlineEm = t("headlineEmphasis");
  const [hBefore, hAfter] = splitOnce(t("headline"), headlineEm);
  const availTitleEm = tAvailable("titleEmphasis");
  const [aBefore, aAfter] = splitOnce(tAvailable("title"), availTitleEm);
  const histTitleEm = tHist("titleEmphasis");
  const [hpBefore, hpAfter] = splitOnce(tHist("title"), histTitleEm);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-7 md:py-10">
      {/* Header */}
      <header className="grid items-end gap-6 border-b border-border pb-7 md:grid-cols-[1fr_auto]">
        <div className="max-w-[54ch]">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            — {t("eyebrow")}
          </p>
          <h1 className="mt-2 font-serif text-[28px] leading-tight tracking-tight text-foreground md:text-[36px]">
            {hBefore}
            <em className="text-primary-deep">{headlineEm}</em>
            {hAfter}
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
            {t("subtitleLong")}
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <div className="flex gap-5">
            <Stat label={tStats("tools")} value={isLoading ? "—" : toolCount.toString()} />
            <Stat label={tStats("taken")} value={isLoading ? "—" : totalTaken.toString()} />
            <Stat label={tStats("thisMonth")} value={isLoading ? "—" : thisMonthCount.toString()} />
          </div>
        </div>
      </header>

      {/* Safety banner */}
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/50 px-4 py-3.5 sm:grid sm:grid-cols-[auto_1fr_auto] sm:gap-4">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-muted-foreground">
          <ShieldAlert className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <p className="text-[13.5px] leading-relaxed text-foreground/85">
          <strong className="font-medium text-foreground">{tSafety("lead")}</strong>{" "}
          {tSafety("body").replace(tSafety("crisisLink"), "").trimEnd()}{" "}
          <Link href="/resources?category=crisis" className="underline underline-offset-2 hover:text-foreground">
            {tSafety("crisisLink")}
          </Link>
          .
        </p>
        <Link
          href="/assessments/how-we-score"
          className="hidden items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-primary md:inline-flex"
        >
          {tSafety("howScored")}
          <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
        </Link>
      </div>

      {/* Available tools */}
      <section className="mt-9">
        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <h2 className="font-serif text-[20px] font-medium tracking-tight">
            {aBefore}
            <em className="text-foreground">{availTitleEm}</em>
            {aAfter}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {tAvailable("meta", { count: toolCount || 3 })}
          </p>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[320px] rounded-md" />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <AssessmentCard
                key={a.assessment_id}
                item={a}
                lang={locale}
                lastResult={
                  history?.history.find((h) => h.assessment_id === a.assessment_id) ?? null
                }
                onStart={() => router.push(`/assessments/${a.assessment_id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between border-b border-border pb-3">
          <h2 className="font-serif text-[20px] font-medium tracking-tight">
            {hpBefore}
            <em className="text-foreground">{histTitleEm}</em>
            {hpAfter}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {tHist("meta", { count: history?.total ?? 0, days: 90 })}
          </p>
        </div>

        {isLoading ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="my-1 h-12 w-full" />
              ))}
            </Card>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[140px] rounded-md" />
              ))}
            </div>
          </div>
        ) : !history || history.total === 0 ? (
          <div className="mt-6 rounded-md border border-dashed border-border bg-secondary/30 px-6 py-10 text-center">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" strokeWidth={1.5} />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              {tHist("noHistory")}
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card className="p-1.5">
              <ul className="flex flex-col">
                {history.history.slice(0, 12).map((h) => (
                  <li key={h.user_assessment_id}>
                    <HistoryRow item={h} items={items} locale={locale} />
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-3">
              {Object.entries(trendsByType).map(([type, points]) => {
                const item = items.find((i) => i.assessment_type === type);
                if (!item) return null;
                const pointsWithLevel = points.map((p) => ({ ...p }));
                return (
                  <ScoreTrendMini
                    key={type}
                    assessmentType={type}
                    name={locale === "am" && item.name_am ? item.name_am : item.name}
                    points={pointsWithLevel}
                    maxScore={maxScoreFor(type)}
                  />
                );
              })}
              {Object.keys(trendsByType).length === 0 && (
                <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                  {tHist("noDataHint")}
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-left md:text-right">
      <p className="font-serif text-[22px] font-medium leading-none tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

interface CardProps {
  item: AssessmentListItem;
  lang: string;
  lastResult: AssessmentHistoryItem | null;
  onStart: () => void;
}

function AssessmentCard({ item, lang, lastResult, onStart }: CardProps) {
  const tCard = useTranslations("assessments.card");
  const tList = useTranslations("assessments.list");
  const relativeDay = useRelativeDay();
  const name = lang === "am" && item.name_am ? item.name_am : item.name;
  const description =
    lang === "am" && item.description_am ? item.description_am : item.description;
  const code = instrumentCode(item.assessment_type);
  const Icon = item.assessment_type === "depression"
    ? Brain
    : item.assessment_type === "anxiety"
      ? HeartPulse
      : Activity;
  const due = readDue(item.assessment_type);

  return (
    <Card className="flex flex-col overflow-hidden p-0">
      {/* Cover */}
      <div className="relative p-6 pb-4">
        <div
          className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full blur-3xl"
          style={{ background: "color-mix(in oklab, var(--primary) 16%, transparent)" }}
          aria-hidden
        />

        <div className="flex items-start justify-between gap-3">
          <span
            className="grid h-[46px] w-[46px] place-items-center rounded-md bg-secondary text-primary-deep"
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {tCard("validatedBadge")}
          </span>
        </div>

        <h3 className="relative mt-4 font-serif text-[21px] leading-snug tracking-tight text-foreground">
          {name}
        </h3>
        <p className="relative mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          {code} · {tList("questionsLine", { count: item.question_count })}
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-6 pb-4">
        <p className="line-clamp-3 text-[13.5px] leading-relaxed text-foreground/85">
          {description}
        </p>
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {item.estimated_time && <span>{item.estimated_time}</span>}
          <span aria-hidden>·</span>
          <span>{tCard("items", { n: item.question_count })}</span>
          <span aria-hidden>·</span>
          <span>{tCard("type")}</span>
        </div>

        {/* Last taken / due / not taken */}
        {due.due && due.date ? (
          <div className="mt-4 flex items-center justify-between rounded-md bg-primary-soft px-3 py-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-primary-deep">
              {tCard("dueToday")}
            </p>
            <span className="font-serif text-[12px] text-primary-deep">
              {due.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        ) : lastResult ? (
          <div className="mt-4 flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {tCard("lastTakenAt", { when: relativeDay(lastResult.completed_at) })}
              </p>
              <p className="mt-0.5 font-serif text-[13.5px] text-foreground">
                {lastResult.score}
                <span className="text-muted-foreground">/{lastResult.max_score}</span>
              </p>
            </div>
            <SeverityPill level={lastResult.feedback_level} />
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-border px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {tCard("notTaken")}
            </p>
          </div>
        )}
      </div>

      {/* Foot */}
      <div className="flex items-center justify-between border-t border-border bg-secondary/40 px-6 py-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {tCard("takenNTimes", { n: item.times_taken })}
        </p>
        <Button
          type="button"
          onClick={onStart}
          variant={lastResult ? "ghost" : "default"}
          size="sm"
        >
          {lastResult ? tCard("retakeBtn") : tCard("begin")}
          <ChevronRight className="ml-0.5 h-3.5 w-3.5" strokeWidth={1.75} />
        </Button>
      </div>
    </Card>
  );
}

function HistoryRow({
  item,
  items,
  locale,
}: {
  item: AssessmentHistoryItem;
  items: AssessmentListItem[];
  locale: string;
}) {
  const Icon =
    item.assessment_type === "depression"
      ? Brain
      : item.assessment_type === "anxiety"
        ? HeartPulse
        : Activity;
  const code = instrumentCode(item.assessment_type);
  const target = items.find((i) => i.assessment_type === item.assessment_type)?.assessment_id;
  if (!target) return null;
  return (
    <Link
      href={`/assessments/${target}/results/${item.user_assessment_id}`}
      className="grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-secondary/50"
    >
      <span
        className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-primary-deep"
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="flex items-baseline gap-1.5 truncate text-[13px] font-medium text-foreground">
          <span className="truncate">{item.assessment_name}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {code}
          </span>
        </p>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {formatDate(item.completed_at, locale)}
        </p>
      </div>
      <p className="text-right font-serif text-[16px] tabular-nums text-foreground">
        {item.score}
        <span className="text-[11px] text-muted-foreground">/{item.max_score}</span>
      </p>
      <SeverityPill level={item.feedback_level} />
    </Link>
  );
}

function SeverityPill({ level }: { level: string }) {
  const idx = levelToIndex(level);
  const levelLabel = useLevelLabel();
  return (
    <span
      className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
      style={{
        backgroundColor: `color-mix(in oklab, var(--lvl-${idx}) 14%, transparent)`,
        color: `var(--lvl-${idx})`,
        border: `1px solid color-mix(in oklab, var(--lvl-${idx}) 30%, transparent)`,
      }}
    >
      {levelLabel(level)}
    </span>
  );
}

function maxScoreFor(type: string): number {
  if (type === "depression") return 27;
  if (type === "anxiety") return 21;
  if (type === "stress") return 28;
  return 30;
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  if (i === -1) return [s, ""];
  return [s.slice(0, i), s.slice(i + sep.length)];
}
