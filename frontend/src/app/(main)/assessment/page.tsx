"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import AssessmentSelector from "@/components/assessment/AssessmentSelector";
import QuestionnaireFlow from "@/components/assessment/QuestionnaireFlow";
import AssessmentResult from "@/components/assessment/AssessmentResult";
import AssessmentHistory from "@/components/assessment/AssessmentHistory";

type AssessmentType = "gad7" | "phq9" | null;
type View = "selector" | "questionnaire" | "result" | "history";

export default function AssessmentPage() {
  const t = useTranslations("assessment");
  const [view, setView] = useState<View>("selector");
  const [assessmentType, setAssessmentType] = useState<AssessmentType>(null);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  const handleStartAssessment = (type: AssessmentType) => {
    setAssessmentType(type);
    setView("questionnaire");
  };

  const handleCompleteAssessment = (result: any) => {
    setAssessmentResult(result);
    setView("result");
  };

  const handleBackToSelector = () => {
    setView("selector");
    setAssessmentType(null);
    setAssessmentResult(null);
  };

  const handleViewHistory = () => {
    setView("history");
  };

  const renderView = () => {
    switch (view) {
      case "selector":
        return (
          <AssessmentSelector
            onStartAssessment={handleStartAssessment}
            onViewHistory={handleViewHistory}
          />
        );
      case "questionnaire":
        return (
          <QuestionnaireFlow
            type={assessmentType!}
            onComplete={handleCompleteAssessment}
            onCancel={handleBackToSelector}
          />
        );
      case "result":
        return (
          <AssessmentResult
            result={assessmentResult}
            type={assessmentType!}
            onRetake={() => setView("questionnaire")}
            onBack={() => setView("selector")}
            onViewHistory={handleViewHistory}
          />
        );
      case "history":
        return (
          <AssessmentHistory
            onBack={() => setView("selector")}
            onStartAssessment={handleStartAssessment}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>
      
      {renderView()}
    </div>
  );
}
