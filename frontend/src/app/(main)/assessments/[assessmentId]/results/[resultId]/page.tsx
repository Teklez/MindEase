"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { AssessmentResultView } from "@/components/assessments/AssessmentResultView";
import { getAssessment, getAssessmentHistory, getAssessmentResult } from "@/lib/api";
import type {
  AssessmentFull,
  AssessmentHistory,
  AssessmentResult,
} from "@/lib/types";

export default function PastResultPage() {
  const params = useParams<{ assessmentId: string; resultId: string }>();
  const router = useRouter();
  const locale = useLocale();

  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [assessment, setAssessment] = useState<AssessmentFull | null>(null);
  const [history, setHistory] = useState<AssessmentHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAssessmentResult(params.resultId),
      getAssessment(params.assessmentId),
    ]).then(([resultRes, assessmentRes]) => {
      if (cancelled) return;
      if (!resultRes.ok || !assessmentRes.ok) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      setResult(resultRes.data);
      setAssessment(assessmentRes.data);
      getAssessmentHistory(resultRes.data.assessment_type).then((res) => {
        if (cancelled) return;
        if (res.ok) setHistory(res.data);
        setIsLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [params.assessmentId, params.resultId]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={1.75} />
      </div>
    );
  }

  if (notFound || !result || !assessment) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12 text-center">
        <p className="font-serif text-lg text-foreground">Result not found</p>
      </div>
    );
  }

  const trend = history?.score_trends?.[result.assessment_type] ?? [];

  return (
    <AssessmentResultView
      result={result}
      scoring={assessment.scoring_logic}
      trend={trend}
      lang={locale}
      onRetake={() => router.push(`/assessments/${params.assessmentId}`)}
    />
  );
}
