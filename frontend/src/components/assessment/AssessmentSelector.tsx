"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Heart, History, ArrowRight } from "lucide-react";

type AssessmentType = "gad7" | "phq9";

interface AssessmentSelectorProps {
  onStartAssessment: (type: AssessmentType) => void;
  onViewHistory: () => void;
}

export default function AssessmentSelector({ onStartAssessment, onViewHistory }: AssessmentSelectorProps) {
  const t = useTranslations("assessment");

  const assessments = [
    {
      type: "gad7" as AssessmentType,
      title: t("gad7.title"),
      description: t("gad7.description"),
      duration: t("gad7.duration"),
      icon: Brain,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      type: "phq9" as AssessmentType,
      title: t("phq9.title"),
      description: t("phq9.description"),
      duration: t("phq9.duration"),
      icon: Heart,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="text-center space-y-4">
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("intro")}
        </p>
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onViewHistory}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            {t("viewHistory")}
          </Button>
        </div>
      </div>

      {/* Assessment Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {assessments.map((assessment) => {
          const Icon = assessment.icon;
          return (
            <Card
              key={assessment.type}
              className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 group"
              onClick={() => onStartAssessment(assessment.type)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${assessment.bgColor}`}>
                    <Icon className={`h-6 w-6 ${assessment.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-xl">{assessment.title}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {assessment.duration}
                    </CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{assessment.description}</p>
                <div className="mt-4">
                  <Button className="w-full">
                    {t("startAssessment")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Important Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center">
              <span className="text-amber-800 text-sm font-medium">!</span>
            </div>
          </div>
          <div>
            <h3 className="font-medium text-amber-900">{t("disclaimer.title")}</h3>
            <p className="text-sm text-amber-800 mt-1">{t("disclaimer.text")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
