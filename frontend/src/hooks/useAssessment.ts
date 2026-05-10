"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAssessment, submitAssessment } from "@/lib/api";
import type { AssessmentFull, AssessmentResult } from "@/lib/types";

export interface UseAssessment {
  assessment: AssessmentFull | null;
  isLoading: boolean;
  loadError: string | null;
  currentIndex: number;
  totalQuestions: number;
  progress: number;
  responses: Map<number, number>;
  selectResponse: (questionId: number, value: number) => void;
  goNext: () => void;
  goBack: () => void;
  canGoNext: boolean;
  isLast: boolean;
  submit: () => Promise<AssessmentResult | null>;
  isSubmitting: boolean;
  result: AssessmentResult | null;
  reset: () => void;
}

export function useAssessment(assessmentId: string): UseAssessment {
  const [assessment, setAssessment] = useState<AssessmentFull | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Map<number, number>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getAssessment(assessmentId).then((res) => {
      if (cancelled) return;
      if (res.ok) setAssessment(res.data);
      else setLoadError(res.error ?? "Failed to load assessment");
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  const totalQuestions = assessment?.questions.length ?? 0;
  const isLast = totalQuestions > 0 && currentIndex === totalQuestions - 1;
  const progress = totalQuestions > 0 ? (currentIndex + 1) / totalQuestions : 0;

  const currentQuestion = assessment?.questions[currentIndex] ?? null;
  const canGoNext =
    currentQuestion !== null && responses.has(currentQuestion.id);

  const selectResponse = useCallback((questionId: number, value: number) => {
    setResponses((prev) => {
      const next = new Map(prev);
      next.set(questionId, value);
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, Math.max(totalQuestions - 1, 0)));
  }, [totalQuestions]);

  const goBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const submit = useCallback(async (): Promise<AssessmentResult | null> => {
    if (!assessment) return null;
    const payload = assessment.questions.map((q) => ({
      question_id: q.id,
      value: responses.get(q.id) ?? 0,
    }));
    setIsSubmitting(true);
    const res = await submitAssessment(assessment.assessment_id, payload);
    setIsSubmitting(false);
    if (res.ok) {
      setResult(res.data);
      return res.data;
    }
    return null;
  }, [assessment, responses]);

  const reset = useCallback(() => {
    setResponses(new Map());
    setCurrentIndex(0);
    setResult(null);
  }, []);

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}
