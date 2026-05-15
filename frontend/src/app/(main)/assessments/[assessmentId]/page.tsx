"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssessment } from "@/hooks/useAssessment";
import { CrisisInterstitial } from "@/components/assessments/CrisisInterstitial";
import { AssessmentResultView } from "@/components/assessments/AssessmentResultView";
import { getAssessmentHistory } from "@/lib/api";
import { instrumentCode } from "@/lib/assessment-level";
import type { AssessmentHistory } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TakeAssessmentPage() {
  const params = useParams<{ assessmentId: string }>();
  const router = useRouter();
  const t = useTranslations("assessments");
  const tTake = useTranslations("assessments.take");
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

  const crisisQuestionId = assessment?.scoring_logic.crisis_question_id;
  const crisisThreshold = assessment?.scoring_logic.crisis_threshold ?? 1;

  const handleNext = async () => {
    if (!canGoNext || !currentQuestion) return;
    if (
      crisisQuestionId !== undefined &&
      currentQuestion.id === crisisQuestionId &&
      (selectedValue ?? 0) >= crisisThreshold
    ) {
      // The answer is already saved to `responses` before we trigger the
      // interstitial — see useAssessment.selectResponse.
      setShowCrisisInterstitial(true);
      return;
    }
    if (isLast) {
      await submit();
      return;
    }
    goNext();
  };

  // Keyboard: 1..N select, Enter advances, Escape saves & exits.
  useEffect(() => {
    if (showCrisisInterstitial || result) return;
    if (!currentQuestion || !options.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        router.push("/assessments");
        return;
      }
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
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center">
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
        lang={locale}
        onContinue={() => {
          setShowCrisisInterstitial(false);
          if (isLast) {
            void submit();
          } else {
            goNext();
          }
        }}
        onComeBackLater={() => {
          setShowCrisisInterstitial(false);
          router.push("/assessments");
        }}
      />
    );
  }

  const questionText =
    locale === "am" && currentQuestion?.text_am
      ? currentQuestion.text_am
      : (currentQuestion?.text ?? "");

  const code = instrumentCode(assessment.assessment_type);
  const preamble =
    assessment.assessment_type === "stress"
      ? tTake("preamblePss")
      : tTake("preambleDefault");
  const hasResponses = responses.size > 0;
  const keyboardKeys = options.map((_, i) => i + 1).join(" ");

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-background">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-4 py-3.5 md:px-7">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4">
          <Link
            href="/assessments"
            className="inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" strokeWidth={1.75} />
            {tTake("back")}
          </Link>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="hidden font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground sm:block">
            {tTake("questionOf", { current: currentIndex + 1, total: totalQuestions })}
          </p>
          {hasResponses && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-primary-deep">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              {tTake("saved")}
            </span>
          )}
        </div>
      </div>

      {/* Question body */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-background to-secondary/30 px-4 py-10 md:px-7 md:py-14">
        <div className="mx-auto w-full max-w-xl">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            — {code} · {preamble}
          </p>
          <h1
            key={currentIndex}
            className="mt-3 animate-fade-in font-serif text-[28px] font-normal leading-tight tracking-tight text-foreground md:text-[30px]"
          >
            {questionText}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            {tTake("subhint")}
          </p>

          <div className="mt-8 flex flex-col gap-2">
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
                    "grid w-full grid-cols-[24px_1fr_auto] items-center gap-3 rounded-md border px-4 py-3 text-left transition-all",
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
                      : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-secondary/50",
                  )}
                  aria-pressed={selected}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-all",
                      selected
                        ? "border-primary-foreground bg-primary-foreground text-primary"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="text-[15px] leading-snug">{optLabel}</span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                      selected
                        ? "border-primary-foreground/40 bg-primary-foreground/15"
                        : "border-border bg-secondary text-muted-foreground",
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
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-3 md:px-7">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:block">
            <Kbd>{keyboardKeys || "1"}</Kbd> {tTake("kbdSelect", { keys: "" }).replace("select", "select") /* keep template safe */} ·{" "}
            <Kbd>⏎</Kbd> next · <Kbd>⎋</Kbd> save &amp; exit
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={currentIndex === 0 || isSubmitting}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
              {tTake("back")}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <>
                  {isLast ? tTake("seeResultsLabel") : tTake("next")}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" strokeWidth={1.75} />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-secondary px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-foreground/80">
      {children}
    </kbd>
  );
}
