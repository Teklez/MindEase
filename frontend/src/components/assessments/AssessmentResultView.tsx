"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Download,
  ExternalLink,
  LifeBuoy,
  MessageSquare,
  Phone,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreRing } from "@/components/assessments/ScoreRing";
import { toast } from "@/hooks/use-toast";
import { exportAssessments } from "@/lib/export";
import { getCrisisResources } from "@/lib/crisis-resources";
import {
  instrumentCode,
  levelToIndex,
} from "@/lib/assessment-level";
import { useLevelLabel } from "@/hooks/useLevelLabel";
import { cn } from "@/lib/utils";
import type {
  AssessmentRange,
  AssessmentResult,
  AssessmentScoringLogic,
} from "@/lib/types";

interface Props {
  result: AssessmentResult;
  scoring: AssessmentScoringLogic;
  trend?: { date: string; score: number }[];
  onRetake: () => void;
  lang: string;
}

const RANGE_TOGGLE = ["90D", "6M", "1Y", "All"] as const;
type Range = (typeof RANGE_TOGGLE)[number];

export function AssessmentResultView({
  result,
  scoring,
  trend,
  onRetake,
  lang,
}: Props) {
  const t = useTranslations("assessments.result");
  const tExport = useTranslations("export");
  const levelLabel = useLevelLabel();
  const router = useRouter();
  const [range, setRange] = useState<Range>("90D");

  const levelIdx = levelToIndex(result.feedback_level);
  const code = instrumentCode(result.assessment_type);

  const range_ = findRange(result.feedback_level, scoring);
  const levelDisplay =
    lang === "am" && range_?.label_am
      ? range_.label_am
      : (range_?.label ?? levelLabel(result.feedback_level));
  const feedbackText =
    lang === "am" && result.feedback_text_am
      ? result.feedback_text_am
      : result.feedback_text;

  const completedDate = new Date(result.completed_at);
  const ringColor = `var(--lvl-${levelIdx})`;

  const trendData = useMemo(
    () => filterTrend(trend ?? [], range, result),
    [trend, range, result],
  );

  // Severity scale geometry — pointer position as percent of max.
  const pointerPct = Math.min(
    100,
    Math.max(0, (result.score / Math.max(result.max_score, 1)) * 100),
  );

  const showSafetyCard = levelIdx >= 3 || result.crisis_detected;

  const onPdf = async () => {
    try {
      await exportAssessments("pdf", result.user_assessment_id);
    } catch (err) {
      toast({
        title: tExport("title"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  // Headline split
  const headline = t("headline");
  const emphasis = t("headlineEmphasis");
  const [hBefore, hAfter] = splitOnce(headline, emphasis);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 md:px-7 md:py-10">
      <Link
        href="/assessments"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
        Back to assessments
      </Link>

      {/* Header */}
      <header className="grid items-end gap-6 border-b border-border pb-7 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            — {t("crumb", { name: result.assessment_name, code })}
          </p>
          <h1 className="mt-2 font-serif text-[28px] leading-tight tracking-tight text-foreground md:text-[32px]">
            {hBefore}
            <em className="text-primary-deep">{emphasis}</em>
            {hAfter}
          </h1>
        </div>
        <div className="text-right font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <div>{t("completed")}</div>
          <div className="mt-0.5 font-serif text-[13.5px] normal-case tracking-normal text-foreground">
            {completedDate.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        {/* Left column */}
        <div className="flex flex-col gap-5">
          {/* Score hero */}
          <Card className="relative overflow-hidden p-6 md:p-8">
            <div
              className="pointer-events-none absolute -top-12 right-[-60px] h-[260px] w-[260px] rounded-full blur-3xl"
              style={{ background: `color-mix(in oklab, ${ringColor} 22%, transparent)` }}
              aria-hidden
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              — {t("yourScore")}
            </p>

            <div className="mt-4 grid items-center gap-7 sm:grid-cols-[auto_1fr]">
              <ScoreRing
                score={result.score}
                maxScore={result.max_score}
                color={ringColor}
                label={t("scoreLabel", { code })}
              />
              <div className="min-w-0">
                <h2 className="font-serif text-[22px] leading-snug tracking-tight text-foreground md:text-[26px]">
                  {t("rangeHeadlinePrefix")}{" "}
                  <em className="text-foreground">{levelDisplay.toLowerCase()}</em>{" "}
                  {t("rangeHeadlineSuffix")}
                </h2>
                <span
                  className={cn(
                    "mt-2 inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                  )}
                  style={{
                    backgroundColor: `color-mix(in oklab, ${ringColor} 16%, transparent)`,
                    color: ringColor,
                    border: `1px solid color-mix(in oklab, ${ringColor} 30%, transparent)`,
                  }}
                >
                  {levelDisplay}
                </span>
                <p className="mt-3 text-[14.5px] leading-relaxed text-foreground/85">
                  {feedbackText}
                </p>
              </div>
            </div>

            {/* Severity scale */}
            <div className="mt-7 border-t border-border pt-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("severityScale")} · {t("thresholds", { code })}
              </p>
              <div className="relative mt-4 h-2 w-full rounded-full bg-gradient-to-r from-level-1 via-level-3 to-level-5">
                <span
                  className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-foreground bg-background shadow-soft"
                  style={{ left: `${pointerPct}%` }}
                  aria-hidden
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.1em] sm:grid-cols-3 md:grid-cols-5">
                {scoring.ranges.map((r) => {
                  const isActive = r.level === result.feedback_level;
                  const label =
                    lang === "am" && r.label_am ? r.label_am : r.label;
                  return (
                    <span
                      key={r.level}
                      className={cn(
                        isActive
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {label} · {r.min}–{r.max}
                    </span>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Trend chart */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-serif text-[15px] font-medium tracking-tight">
                {t("yourLine").replace(t("yourLineEmphasis"), "")}
                <em className="text-foreground">{t("yourLineEmphasis")}</em>
              </p>
              <div className="flex gap-0.5 rounded-full border border-border bg-background p-0.5">
                {RANGE_TOGGLE.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={cn(
                      "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors",
                      range === r
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {trendData.length === 0 ? (
              <div className="mt-5 flex h-[140px] items-center justify-center font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/70">
                {t("noHistoryYet")}
              </div>
            ) : (
              <div className="mt-3 h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${levelIdx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ringColor} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={ringColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono,monospace)" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono,monospace)" }}
                      tickLine={false}
                      axisLine={false}
                      domain={[0, result.max_score]}
                      width={28}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke={ringColor}
                      strokeWidth={2}
                      fill={`url(#grad-${levelIdx})`}
                      dot={{ r: 2.5, fill: ringColor, stroke: "var(--background)", strokeWidth: 1 }}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Suggested next steps */}
          <Card className="p-5">
            <p className="font-serif text-[15px] font-medium tracking-tight">
              {t("nextSteps").replace(t("nextStepsEmphasis"), "")}
              <em className="text-foreground">{t("nextStepsEmphasis")}</em>
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              <NextStep
                Icon={MessageSquare}
                title={t("talkItThrough")}
                subtitle={t("talkItThroughSub")}
                onClick={() => router.push("/chat")}
              />
              <NextStep
                Icon={Phone}
                title={t("findClinician")}
                subtitle={t("findClinicianSub")}
                onClick={() => router.push("/resources?category=clinician")}
              />
              <NextStep
                Icon={Users2}
                title={t("joinGroup")}
                subtitle={t("joinGroupSub")}
                onClick={() => router.push("/groups")}
              />
              <NextStep
                Icon={BookOpen}
                title={t("exploreResources")}
                subtitle={t("exploreResourcesSub")}
                onClick={() => router.push("/resources")}
              />
            </ul>
          </Card>

          {/* Safety card */}
          {showSafetyCard && (
            <Card className="border-border bg-muted/40 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground">
                  <LifeBuoy className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="font-serif text-[15px] font-medium tracking-tight">
                    {t("ifHeavy")}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">
                    {t("ifHeavyBody")}
                  </p>
                  <ul className="mt-3 flex flex-col gap-1">
                    {getCrisisResources(lang).map((r) => {
                      const Icon =
                        r.type === "phone"
                          ? Phone
                          : r.type === "sms"
                            ? MessageSquare
                            : ExternalLink;
                      return (
                        <li key={r.id}>
                          <a
                            href={r.href}
                            target={r.type === "url" ? "_blank" : undefined}
                            rel={r.type === "url" ? "noopener noreferrer" : undefined}
                            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-foreground transition-colors hover:bg-background"
                          >
                            <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                            <span className="font-medium">{r.name}</span>
                            <span className="ml-auto font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              {r.contact}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-secondary/40 px-5 py-4">
        <p className="max-w-[48ch] text-[13px] leading-relaxed text-foreground/85">
          <strong className="font-medium text-foreground">{t("notDiagnosisStrong")}</strong>{" "}
          {t("notDiagnosis")
            .replace(t("notDiagnosisStrong"), "")
            .replace(/^\s+/, "")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={onPdf} className="gap-1.5">
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            {tExport("downloadResults")}
          </Button>
          <Button onClick={onRetake} className="gap-1.5">
            {t("retakeIn")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NextStep({
  Icon,
  title,
  subtitle,
  onClick,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary/60"
      >
        <span
          className="grid h-[34px] w-[34px] place-items-center rounded-md bg-secondary text-primary-deep"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium text-foreground">{title}</p>
          <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      </button>
    </li>
  );
}

function findRange(level: string, scoring: AssessmentScoringLogic): AssessmentRange | null {
  return scoring.ranges.find((r) => r.level === level) ?? null;
}

function splitOnce(s: string, sep: string): [string, string] {
  const i = s.indexOf(sep);
  if (i === -1) return [s, ""];
  return [s.slice(0, i), s.slice(i + sep.length)];
}

function filterTrend(
  points: { date: string; score: number }[],
  range: Range,
  result: AssessmentResult,
): { label: string; score: number; date: string }[] {
  if (points.length === 0) return [];
  const now = Date.now();
  const cutoff =
    range === "90D"
      ? now - 90 * 24 * 3600 * 1000
      : range === "6M"
        ? now - 182 * 24 * 3600 * 1000
        : range === "1Y"
          ? now - 365 * 24 * 3600 * 1000
          : 0;
  const filtered = points.filter((p) => new Date(p.date).getTime() >= cutoff);
  // Ensure the current result is the last point so the chart shows today.
  const last = filtered[filtered.length - 1];
  const includeCurrent =
    !last || new Date(last.date).getTime() !== new Date(result.completed_at).getTime();
  const series = includeCurrent
    ? [...filtered, { date: result.completed_at, score: result.score }]
    : filtered;
  return series.map((p) => ({
    label: new Date(p.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    score: p.score,
    date: p.date,
  }));
}
