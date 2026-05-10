"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, BookOpen, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreRing } from "@/components/assessments/ScoreRing";
import { ScoreTrendMini } from "@/components/assessments/ScoreTrendMini";
import CrisisBanner from "@/components/chat/CrisisBanner";
import type {
  AssessmentRange,
  AssessmentResult,
  AssessmentScoringLogic,
} from "@/lib/types";

const AVATAR_LABELS: Record<string, string> = {
  sage: "Sage",
  dr_chen: "Dr. Chen",
  marcus: "Marcus",
  kira: "Kira",
};

interface Props {
  result: AssessmentResult;
  scoring: AssessmentScoringLogic;
  trend?: { date: string; score: number }[];
  onRetake: () => void;
  lang: string;
}

function findRange(level: string, scoring: AssessmentScoringLogic): AssessmentRange | null {
  return scoring.ranges.find((r) => r.level === level) ?? null;
}

export function AssessmentResultView({
  result,
  scoring,
  trend,
  onRetake,
  lang,
}: Props) {
  const t = useTranslations("assessments");
  const router = useRouter();
  const range = findRange(result.feedback_level, scoring);
  const label = lang === "am" && range?.label_am ? range.label_am : range?.label ?? result.feedback_level;
  const feedbackText =
    lang === "am" && result.feedback_text_am
      ? result.feedback_text_am
      : result.feedback_text;
  const avatarLabel = result.recommended_avatar
    ? AVATAR_LABELS[result.recommended_avatar] ?? result.recommended_avatar
    : null;
  const tint = `${result.color}14`; // ~8% alpha

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8 md:py-14">
      {result.crisis_detected && result.crisis_resources && (
        <CrisisBanner resources={result.crisis_resources} onDismiss={() => {}} />
      )}

      <Card className="overflow-hidden p-6 md:p-10" style={{ backgroundColor: tint }}>
        <div className="mb-6 flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("yourScore")}
          </p>
          <h1 className="mt-1 font-serif text-2xl text-foreground md:text-3xl">
            {result.assessment_name}
          </h1>
        </div>

        <div className="flex flex-col items-center">
          <ScoreRing
            score={result.score}
            maxScore={result.max_score}
            color={result.color}
            label={label}
          />
        </div>

        <div className="mt-8 rounded-lg bg-background/70 p-5 backdrop-blur">
          <p className="text-sm leading-relaxed text-foreground">{feedbackText}</p>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <ShieldAlert className="h-3 w-3" strokeWidth={1.75} />
            {t("notDiagnosis")}
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {avatarLabel && (
            <Button
              className="h-auto py-3"
              variant="default"
              onClick={() => router.push("/chat")}
            >
              <Sparkles className="mr-2 h-4 w-4" strokeWidth={1.75} />
              {t("talkTo", { avatar: avatarLabel })}
            </Button>
          )}
          <Button
            className="h-auto py-3"
            variant="outline"
            onClick={() => router.push("/resources")}
          >
            <BookOpen className="mr-2 h-4 w-4" strokeWidth={1.75} />
            {t("exploreResources")}
          </Button>
        </div>
      </Card>

      {result.recommended_resources.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-lg text-foreground">
            {t("exploreResources")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {result.recommended_resources.slice(0, 3).map((r) => (
              <Card key={r.resource_id} className="p-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {r.resource_type}
                </p>
                <p className="mt-1 line-clamp-2 font-serif text-[15px] leading-snug text-foreground">
                  {lang === "am" && r.title_am ? r.title_am : r.title}
                </p>
                <p className="mt-2 text-[11.5px] italic text-muted-foreground">
                  {r.reason}
                </p>
                {r.duration && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{r.duration}</p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {trend && trend.length > 1 && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-lg text-foreground">
            {t("scoreHistory")}
          </h2>
          <Card className="p-4">
            <ScoreTrendMini
              points={trend}
              maxScore={result.max_score}
              color={result.color}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              {trend.length} previous {trend.length === 1 ? "result" : "results"}
            </p>
          </Card>
        </section>
      )}

      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <Button variant="ghost" onClick={onRetake}>
          <RotateCcw className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
          {t("retake")}
        </Button>
        <Button variant="outline" onClick={() => router.push("/assessments")}>
          {t("viewAll")}
          <ArrowRight className="ml-1.5 h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}
