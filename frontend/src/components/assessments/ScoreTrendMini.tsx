"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Activity, Brain, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  instrumentCode,
  instrumentTone,
  levelToIndex,
} from "@/lib/assessment-level";

interface Props {
  assessmentType: string;
  name: string;
  points: { date: string; score: number; level?: string }[];
  maxScore: number;
  /** Override the "Last 90 days" footer label. */
  rangeLabel?: string;
}

type Direction = "down" | "steady" | "up" | "none";

/**
 * Compact trend card for the listing page. Header row (icon + name + trend
 * pill) over a hand-rolled SVG mini-chart over a footer (range + latest
 * score). Hand-rolled SVG keeps these tiny and fast (no recharts overhead).
 */
export function ScoreTrendMini({
  assessmentType,
  name,
  points,
  maxScore,
  rangeLabel,
}: Props) {
  const t = useTranslations("assessments.historyPanel");
  const tone = instrumentTone(assessmentType);
  const code = instrumentCode(assessmentType);
  const Icon = iconFor(assessmentType);

  const direction = useMemo(() => trendDirection(points), [points]);
  const last = points[points.length - 1];
  const lastLevel = last?.level ?? "moderate";
  const lastLevelIdx = levelToIndex(lastLevel);

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <header className="flex items-center gap-2">
        <div
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md",
            tone === "sage" && "bg-secondary text-primary-deep",
            tone === "honey" && "bg-honey-soft text-honey-deep",
            tone === "dawn" && "bg-dawn-soft text-dawn-deep",
          )}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
        <p className="flex items-baseline gap-1.5 min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
          <span className="truncate">{name}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {code}
          </span>
        </p>
        <TrendPill direction={direction} t={t} />
      </header>

      <div className="mt-3">
        {points.length === 0 ? (
          <div className="flex h-[54px] items-center justify-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
            {t("noDataHint")}
          </div>
        ) : (
          <MiniChart
            points={points}
            maxScore={maxScore}
            lastLevelIdx={lastLevelIdx}
          />
        )}
      </div>

      <footer className="mt-2 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
        <span>{rangeLabel ?? t("lastN", { days: 90, n: points.length })}</span>
        {last && (
          <span>
            {last.score}
            <span className="opacity-60">/{maxScore}</span>
          </span>
        )}
      </footer>
    </div>
  );
}

function MiniChart({
  points,
  maxScore,
  lastLevelIdx,
}: {
  points: { score: number }[];
  maxScore: number;
  lastLevelIdx: number;
}) {
  const w = 200;
  const h = 54;
  const pad = 6;

  const path = useMemo(() => {
    const dots = points.map((p, i) => {
      const x =
        points.length === 1
          ? w / 2
          : pad + (i * (w - pad * 2)) / (points.length - 1);
      const y = h - pad - (p.score / Math.max(maxScore, 1)) * (h - pad * 2);
      return { x, y };
    });
    if (dots.length === 1) {
      return {
        line: `M${dots[0].x},${dots[0].y}`,
        area: "",
        dots,
      };
    }
    // Catmull-Rom-ish smoothing (cardinal spline) for a soft curve.
    const segments: string[] = [`M${dots[0].x.toFixed(1)},${dots[0].y.toFixed(1)}`];
    for (let i = 0; i < dots.length - 1; i++) {
      const p0 = dots[i - 1] ?? dots[i];
      const p1 = dots[i];
      const p2 = dots[i + 1];
      const p3 = dots[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      segments.push(
        `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
      );
    }
    const line = segments.join(" ");
    const area = `${line} L${dots[dots.length - 1].x.toFixed(1)},${h - pad} L${dots[0].x.toFixed(1)},${h - pad} Z`;
    return { line, area, dots };
  }, [points, maxScore]);

  const stroke = `var(--lvl-${lastLevelIdx})`;
  const gradId = `mini-fill-${lastLevelIdx}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[54px] w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.32} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {path.area && <path d={path.area} fill={`url(#${gradId})`} />}
      <path
        d={path.line}
        stroke={stroke}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {path.dots.map((d, i) => {
        const isLast = i === path.dots.length - 1;
        return (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={isLast ? 3 : 1.6}
            fill={isLast ? "var(--foreground)" : stroke}
            stroke={isLast ? "var(--background)" : undefined}
            strokeWidth={isLast ? 2 : 0}
          />
        );
      })}
    </svg>
  );
}

function TrendPill({
  direction,
  t,
}: {
  direction: Direction;
  t: ReturnType<typeof useTranslations<"assessments.historyPanel">>;
}) {
  if (direction === "none") {
    return (
      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {t("noData")}
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className="shrink-0 rounded-full bg-level-1/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-level-1">
        {t("trendingDown")}
      </span>
    );
  }
  if (direction === "steady") {
    return (
      <span className="shrink-0 rounded-full bg-honey-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-honey-deep">
        {t("steady")}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-level-4/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-level-4">
      {t("trendingUp")}
    </span>
  );
}

function iconFor(assessmentType: string) {
  switch (assessmentType) {
    case "depression":
      return Brain;
    case "anxiety":
      return HeartPulse;
    default:
      return Activity;
  }
}

/**
 * Linear regression on the (x, score) series. Returns trend direction.
 * For all current instruments higher score = worse, so positive slope is
 * "Climbing" and negative is "Trending down."
 */
function trendDirection(
  points: { score: number }[],
): Direction {
  if (points.length < 2) return "none";
  const n = points.length;
  const meanX = (n - 1) / 2;
  const meanY = points.reduce((s, p) => s + p.score, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((p, i) => {
    num += (i - meanX) * (p.score - meanY);
    den += (i - meanX) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  // Steady if slope < half a score-point per step.
  if (Math.abs(slope) < 0.5) return "steady";
  return slope > 0 ? "up" : "down";
}
