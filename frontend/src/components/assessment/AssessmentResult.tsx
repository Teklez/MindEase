"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Calendar, Phone, MessageCircle, ArrowLeft, RotateCcw, History } from "lucide-react";

type AssessmentType = "gad7" | "phq9";

interface AssessmentResultProps {
  result: {
    type: AssessmentType;
    score: number;
    answers: Record<string, number>;
    completedAt: string;
  };
  type: AssessmentType;
  onRetake: () => void;
  onBack: () => void;
  onViewHistory: () => void;
}

interface SeverityLevel {
  range: [number, number];
  label: string;
  description: string;
  color: string;
  bgColor: string;
  recommendations: string[];
}

const GAD7_SEVERITY: SeverityLevel[] = [
  {
    range: [0, 4],
    label: "Minimal anxiety",
    description: "Little to no anxiety symptoms",
    color: "text-green-700",
    bgColor: "bg-green-50",
    recommendations: [
      "Continue monitoring your mental health",
      "Practice stress management techniques",
      "Maintain healthy lifestyle habits"
    ]
  },
  {
    range: [5, 9],
    label: "Mild anxiety",
    description: "Some anxiety symptoms that may be impacting daily life",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    recommendations: [
      "Consider self-help strategies and relaxation techniques",
      "Regular physical activity and mindfulness practice",
      "Monitor symptoms and consider professional help if they worsen"
    ]
  },
  {
    range: [10, 14],
    label: "Moderate anxiety",
    description: "Significant anxiety symptoms that likely impact daily functioning",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    recommendations: [
      "Consider talking to a mental health professional",
      "Practice evidence-based anxiety management techniques",
      "Medication may be considered in consultation with a healthcare provider"
    ]
  },
  {
    range: [15, 21],
    label: "Severe anxiety",
    description: "Serious anxiety symptoms that significantly impact daily life",
    color: "text-red-700",
    bgColor: "bg-red-50",
    recommendations: [
      "Seek professional help from a mental health provider",
      "Consider both therapy and medication treatment options",
      "Develop a comprehensive treatment plan with healthcare professionals"
    ]
  }
];

const PHQ9_SEVERITY: SeverityLevel[] = [
  {
    range: [0, 4],
    label: "Minimal depression",
    description: "Little to no depression symptoms",
    color: "text-green-700",
    bgColor: "bg-green-50",
    recommendations: [
      "Continue monitoring your mental health",
      "Maintain healthy lifestyle habits",
      "Practice self-care and stress management"
    ]
  },
  {
    range: [5, 9],
    label: "Mild depression",
    description: "Some depression symptoms that may be impacting daily life",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    recommendations: [
      "Consider self-help strategies and increased physical activity",
      "Practice mindfulness and maintain social connections",
      "Monitor symptoms and seek help if they persist or worsen"
    ]
  },
  {
    range: [10, 14],
    label: "Moderate depression",
    description: "Significant depression symptoms that impact daily functioning",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50",
    recommendations: [
      "Consider talking to a mental health professional",
      "Practice evidence-based depression management techniques",
      "Treatment with therapy and/or medication may be beneficial"
    ]
  },
  {
    range: [15, 19],
    label: "Moderately severe depression",
    description: "Serious depression symptoms that significantly impact daily life",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    recommendations: [
      "Seek professional help from a mental health provider",
      "Active treatment with therapy and/or medication is recommended",
      "Consider more intensive treatment options"
    ]
  },
  {
    range: [20, 27],
    label: "Severe depression",
    description: "Very serious depression symptoms requiring immediate attention",
    color: "text-red-700",
    bgColor: "bg-red-50",
    recommendations: [
      "Seek immediate professional help from a mental health provider",
      "Comprehensive treatment with therapy and medication is strongly recommended",
      "Consider intensive treatment options or specialist referral"
    ]
  }
];

export default function AssessmentResult({ result, type, onRetake, onBack, onViewHistory }: AssessmentResultProps) {
  const t = useTranslations("assessment");
  const severityLevels = type === "gad7" ? GAD7_SEVERITY : PHQ9_SEVERITY;
  
  const severity = severityLevels.find(level => 
    result.score >= level.range[0] && result.score <= level.range[1]
  ) || severityLevels[0];

  const maxScore = type === "gad7" ? 21 : 27;
  const percentage = (result.score / maxScore) * 100;

  const completionDate = new Date(result.completedAt).toLocaleDateString();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t("backToAssessments")}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onViewHistory} className="gap-2">
            <History className="h-4 w-4" />
            {t("viewHistory")}
          </Button>
          <Button onClick={onRetake} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("retakeAssessment")}
          </Button>
        </div>
      </div>

      {/* Result Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {type === "gad7" ? t("gad7.title") : t("phq9.title")} {t("results")}
            </CardTitle>
            <Badge className={`text-lg px-3 py-1 ${severity.bgColor} ${severity.color} border-0`}>
              {severity.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score Display */}
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-foreground">
              {result.score}/{maxScore}
            </div>
            <div className="text-sm text-muted-foreground">
              {t("completedOn", { date: completionDate })}
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>0</span>
              <span>{t("severityLevel")}: {severity.label}</span>
              <span>{maxScore}</span>
            </div>
            <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${severity.bgColor.replace('bg-', 'bg-opacity-70 bg-')}`}
                style={{ width: `${percentage}%` }}
              />
              <div 
                className="absolute top-0 h-full w-1 bg-foreground transition-all duration-500"
                style={{ left: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Description */}
          <div className={`p-4 rounded-lg ${severity.bgColor} border ${severity.color.replace('text-', 'border-')}`}>
            <p className={severity.color}>
              {severity.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("recommendations")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {severity.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span className="text-foreground">{recommendation}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Professional Help CTA */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-800" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-2">
                {t("professionalHelp.title")}
              </h3>
              <p className="text-amber-800 mb-4">
                {t("professionalHelp.description")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                  <Phone className="h-4 w-4" />
                  {t("professionalHelp.callProfessionals")}
                </Button>
                <Button variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 gap-2">
                  <MessageCircle className="h-4 w-4" />
                  {t("professionalHelp.startChat")}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("nextSteps")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">{t("nextSteps.retake")}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t("nextSteps.retakeDescription")}
              </p>
              <Button size="sm" onClick={onRetake}>
                {t("retakeAssessment")}
              </Button>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">{t("nextSteps.track")}</h4>
              <p className="text-sm text-muted-foreground mb-3">
                {t("nextSteps.trackDescription")}
              </p>
              <Button size="sm" variant="outline" onClick={onViewHistory}>
                {t("viewHistory")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
