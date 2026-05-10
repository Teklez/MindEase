"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssessment } from "@/hooks/useAssessment";
import { CrisisInterstitial } from "@/components/assessments/CrisisInterstitial";
import { AssessmentResultView } from "@/components/assessments/AssessmentResultView";
import { getAssessmentHistory } from "@/lib/api";
import type { AssessmentHistory } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TakeAssessmentPage() {
  const params = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const t = useTranslations("assessments");
  const locale = useLocale();

  const {
    assessment,
    isLoading,
    loadError,
    currentIndex,
    totalQuestions,
    progress,
    responses,
    selectResponse,
    goNext,
    goBack,
    canGoNext,
    isLast,
    submit,
    isSubmitting,
    result,
    reset,
  } = useAssessment(params.assessmentId);

  const [showCrisisInterstitial, setShowCrisisInterstitial] = useState(false);
  const [history, setHistory] = useState<AssessmentHistory | null>(null);

  useEffect(() => {
    if (!result) return;
    getAssessmentHistory(result.assessment_type).then((res) => {
      if (res.ok) setHistory(res.data);
    });
  }, [result]);

  const currentQuestion = assessment?.questions[currentIndex] ?? null;
  const options = assessment?.scoring_logic.options ?? [];
  const selectedValue = currentQuestion ? responses.get(currentQuestion.id) : undefined;

  // Crisis question detection: PHQ-9 Q9 in this app, but driven by scoring_logic.
  const crisisQuestionId = assessment?.scoring_logic.crisis_question_id;
  const crisisThreshold = assessment?.scoring_logic.crisis_threshold ?? 1;

  const handleNext = async () => {
    if (!canGoNext || !currentQuestion) return;

    // Trigger interstitial if just answered the crisis question above threshold.
    if (
      crisisQuestionId !== undefined &&
      currentQuestion.id === crisisQuestionId &&
      (selectedValue ?? 0) >= crisisThreshold
    ) {
      setShowCrisisInterstitial(true);
      return;
    }

    if (isLast) {
      await submit();
      return;
    }
    goNext();
  };

  // Keyboard support: 1..n select option, Enter advances.
  useEffect(() => {
    if (showCrisisInterstitial || result) return;
    if (!currentQuestion || !options.length) return;
    const onKey = (e: KeyboardEvent) => {
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= options.length) {
        const opt = options[num - 1];
        if (opt) selectResponse(currentQuestion.id, opt.value);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (canGoNext) handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, options, canGoNext, isLast, showCrisisInterstitial, result]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={1.75} />
      </div>
    );
  }

  if (loadError || !assessment) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12 text-center">
        <p className="font-serif text-lg text-foreground">
          {loadError ?? "Assessment not found"}
        </p>
        <Button onClick={() => router.replace("/assessments")} className="mt-4">
          {t("viewAll")}
        </Button>
      </div>
    );
  }

  if (result) {
    const trend = history?.score_trends?.[result.assessment_type] ?? [];
    return (
      <AssessmentResultView
        result={result}
        scoring={assessment.scoring_logic}
        trend={trend}
        lang={locale}
        onRetake={() => {
          reset();
          setShowCrisisInterstitial(false);
        }}
      />
    );
  }

  if (showCrisisInterstitial) {
    return (
      <CrisisInterstitial
        resources={CRISIS_RESOURCES_FALLBACK}
        onContinue={() => {
          setShowCrisisInterstitial(false);
          if (isLast) {
            void submit();
          } else {
            goNext();
          }
        }}
      />
    );
  }

  const questionText =
    locale === "am" && currentQuestion?.text_am
      ? currentQuestion.text_am
      : currentQuestion?.text;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Progress bar */}
      <div className="sticky top-16 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3 md:px-8">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {t("question", { current: currentIndex + 1, total: totalQuestions })}
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10 md:px-8 md:py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("question", { current: currentIndex + 1, total: totalQuestions })}
        </p>
        <h1
          key={currentIndex}
          className="mt-3 animate-fade-in font-serif text-2xl leading-snug text-foreground md:text-3xl"
        >
          {questionText}
        </h1>

        <div className="mt-8 space-y-2">
          {options.map((opt, i) => {
            const selected = selectedValue === opt.value;
            const optLabel =
              locale === "am" && opt.label_am ? opt.label_am : opt.label;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  currentQuestion && selectResponse(currentQuestion.id, opt.value)
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-all",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/60 hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    selected
                      ? "border-primary-foreground bg-primary-foreground/15"
                      : "border-border",
                  )}
                >
                  {selected && (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  )}
                </span>
                <span className="flex-1 text-[15px]">{optLabel}</span>
                <span
                  className={cn(
                    "text-[10px] font-medium tabular-nums opacity-50",
                    selected && "opacity-90",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={currentIndex === 0 || isSubmitting}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
            {t("back")}
          </Button>
          <Button onClick={handleNext} disabled={!canGoNext || isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <>
                {isLast ? t("seeResults") : t("next")}
                <ArrowRight className="ml-1.5 h-4 w-4" strokeWidth={1.75} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

const CRISIS_RESOURCES_FALLBACK = {
  ethiopia: [
    { name: "Ethiopian Mental Health Support", phone: "251-111-234-567" },
    { name: "Emergency Services (Ethiopia)", phone: "911" },
  ],
  international: [
    { name: "Crisis Text Line", info: "Text HOME to 741741" },
    {
      name: "International Association for Suicide Prevention",
      url: "https://www.iasp.info/resources/Crisis_Centres/",
    },
  ],
};
