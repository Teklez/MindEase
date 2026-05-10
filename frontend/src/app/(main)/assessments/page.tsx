"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Clock, Loader2, ShieldAlert } from "lucide-react";
import {
  getAssessmentHistory,
  listAssessments,
} from "@/lib/api";
import type {
  AssessmentHistory,
  AssessmentListItem,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreTrendMini } from "@/components/assessments/ScoreTrendMini";
import { cn } from "@/lib/utils";

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "am" ? "am-ET" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AssessmentsPage() {
  const t = useTranslations("assessments");
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
  const maxByType = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of items) {
      // 21 / 27 / 28 — derive from history if present, else fall back to a sensible upper bound
      out[a.assessment_type] = 30;
    }
    return out;
  }, [items]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("title")}
        </p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
      </header>

      <div className="mb-8 flex items-start gap-3 rounded-lg border border-amber-200/60 bg-amber-50/60 p-4 text-[13px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <p className="leading-relaxed">{t("disclaimer")}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[280px] animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((a) => {
            const name = locale === "am" && a.name_am ? a.name_am : a.name;
            const description =
              locale === "am" && a.description_am ? a.description_am : a.description;
            return (
              <Card
                key={a.assessment_id}
                className="group flex h-full flex-col p-6 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              >
                <div className="mb-4 text-4xl" aria-hidden>
                  {a.icon}
                </div>
                <h2 className="font-serif text-xl leading-snug text-foreground">
                  {name}
                </h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{a.question_count} questions</span>
                  {a.estimated_time && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" strokeWidth={1.75} />
                        {a.estimated_time}
                      </span>
                    </>
                  )}
                </div>
                {a.times_taken > 0 && (
                  <div className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
                    {a.last_taken && (
                      <p>
                        {t("lastTaken", { date: formatDate(a.last_taken, locale) })}
                      </p>
                    )}
                    <p>{t("timesTaken", { count: a.times_taken })}</p>
                  </div>
                )}
                <div className="mt-auto pt-5">
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/assessments/${a.assessment_id}`)}
                  >
                    {t("start")}
                    <ArrowRight className="ml-1.5 h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section className="mt-12">
        <h2 className="mb-4 font-serif text-xl text-foreground">{t("history")}</h2>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            <span>{t("history")}…</span>
          </div>
        ) : !history || history.total === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              {history.history.map((h) => (
                <Link
                  key={h.user_assessment_id}
                  href={`/assessments/${getAssessmentIdForType(h.assessment_type, items)}/results/${h.user_assessment_id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="text-2xl" aria-hidden>{h.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {h.assessment_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(h.completed_at, locale)} · {h.score} / {h.max_score}
                    </p>
                  </div>
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize"
                    style={{
                      borderColor: h.color,
                      color: h.color,
                      backgroundColor: `${h.color}1A`,
                    }}
                  >
                    {h.feedback_level.replace(/_/g, " ")}
                  </span>
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                {t("scoreHistory")}
              </h3>
              {Object.entries(trendsByType).map(([type, points]) => {
                const item = items.find((i) => i.assessment_type === type);
                const last = points[points.length - 1];
                const matchingHistory = history.history.find(
                  (h) => h.assessment_type === type,
                );
                const color = matchingHistory?.color ?? "#22C55E";
                return (
                  <Card key={type} className="p-3">
                    <p className={cn("text-[12.5px] font-medium capitalize text-foreground")}>
                      {item?.icon} {type.replace(/_/g, " ")}
                    </p>
                    <ScoreTrendMini
                      points={points}
                      maxScore={maxByType[type] ?? 30}
                      color={color}
                    />
                    {last && (
                      <p className="mt-1 text-[10.5px] text-muted-foreground">
                        Latest: {last.score}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function getAssessmentIdForType(
  type: string,
  items: AssessmentListItem[],
): string {
  return items.find((i) => i.assessment_type === type)?.assessment_id ?? "";
}
