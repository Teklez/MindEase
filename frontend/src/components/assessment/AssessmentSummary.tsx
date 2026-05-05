"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Heart, Calendar, TrendingUp, ChevronRight } from "lucide-react";

interface AssessmentSummaryProps {
  className?: string;
}

interface RecentAssessment {
  type: "gad7" | "phq9";
  score: number;
  date: string;
  severity: string;
}

// Mock data - replace with actual API call
const mockRecentAssessments: RecentAssessment[] = [
  {
    type: "gad7",
    score: 8,
    date: "2024-01-15",
    severity: "Mild anxiety"
  },
  {
    type: "phq9",
    score: 12,
    date: "2024-01-10",
    severity: "Moderate depression"
  }
];

export default function AssessmentSummary({ className }: AssessmentSummaryProps) {
  const t = useTranslations("assessment");
  const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>(mockRecentAssessments);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setRecentAssessments(mockRecentAssessments);
      setLoading(false);
    }, 1000);
  }, []);

  const getSeverityColor = (type: "gad7" | "phq9", score: number) => {
    if (type === "gad7") {
      if (score <= 4) return "bg-green-100 text-green-800";
      if (score <= 9) return "bg-blue-100 text-blue-800";
      if (score <= 14) return "bg-yellow-100 text-yellow-800";
      return "bg-red-100 text-red-800";
    } else {
      if (score <= 4) return "bg-green-100 text-green-800";
      if (score <= 9) return "bg-blue-100 text-blue-800";
      if (score <= 14) return "bg-yellow-100 text-yellow-800";
      if (score <= 19) return "bg-orange-100 text-orange-800";
      return "bg-red-100 text-red-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentAssessments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {t("history.noAssessmentsFound")}
            </p>
            <Link href="/assessment">
              <Button className="w-full">
                {t("startAssessment")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latestAssessment = recentAssessments[0];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <Link href="/assessment">
            <Button variant="ghost" size="sm" className="gap-1">
              {t("viewHistory")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Latest Assessment */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              latestAssessment.type === "gad7" ? "bg-blue-100" : "bg-green-100"
            }`}>
              {latestAssessment.type === "gad7" ? (
                <Brain className="h-4 w-4 text-blue-600" />
              ) : (
                <Heart className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div>
              <div className="font-medium text-sm">
                {latestAssessment.type === "gad7" ? "GAD-7" : "PHQ-9"}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(latestAssessment.date)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{latestAssessment.score}</div>
            <Badge className={`text-xs ${getSeverityColor(latestAssessment.type, latestAssessment.score)}`}>
              {latestAssessment.severity}
            </Badge>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <Link href="/assessment">
            <Button variant="outline" className="w-full justify-between gap-2">
              <span>{t("startAssessment")}</span>
              <TrendingUp className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/assessment?view=history">
            <Button variant="ghost" className="w-full justify-between gap-2">
              <span>{t("history.title")}</span>
              <Calendar className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Total Count */}
        <div className="text-center pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            {t("history.totalAssessments")}: <span className="font-medium text-foreground">{recentAssessments.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
