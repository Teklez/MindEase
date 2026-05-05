"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, TrendingUp, Brain, Heart, Download, Filter } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

type AssessmentType = "gad7" | "phq9";

interface AssessmentHistoryProps {
  onBack: () => void;
  onStartAssessment: (type: AssessmentType) => void;
}

interface AssessmentRecord {
  id: string;
  type: AssessmentType;
  score: number;
  completedAt: string;
  severity: string;
}

// Mock data - replace with actual API call
const mockHistoryData: AssessmentRecord[] = [
  {
    id: "1",
    type: "gad7",
    score: 8,
    completedAt: "2024-01-15T10:30:00Z",
    severity: "Mild anxiety"
  },
  {
    id: "2",
    type: "phq9",
    score: 12,
    completedAt: "2024-01-10T14:20:00Z",
    severity: "Moderate depression"
  },
  {
    id: "3",
    type: "gad7",
    score: 15,
    completedAt: "2024-01-05T09:15:00Z",
    severity: "Moderate anxiety"
  },
  {
    id: "4",
    type: "phq9",
    score: 7,
    completedAt: "2023-12-28T16:45:00Z",
    severity: "Mild depression"
  },
  {
    id: "5",
    type: "gad7",
    score: 11,
    completedAt: "2023-12-20T11:00:00Z",
    severity: "Moderate anxiety"
  }
];

export default function AssessmentHistory({ onBack, onStartAssessment }: AssessmentHistoryProps) {
  const t = useTranslations("assessment");
  const [filter, setFilter] = useState<"all" | "gad7" | "phq9">("all");

  const filteredData = useMemo(() => {
    if (filter === "all") return mockHistoryData;
    return mockHistoryData.filter(record => record.type === filter);
  }, [filter]);

  const chartData = useMemo(() => {
    const groupedByDate = filteredData.reduce((acc, record) => {
      const date = new Date(record.completedAt).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, gad7: null, phq9: null };
      }
      acc[date][record.type] = record.score;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedByDate).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [filteredData]);

  const stats = useMemo(() => {
    const gad7Scores = filteredData.filter(r => r.type === "gad7").map(r => r.score);
    const phq9Scores = filteredData.filter(r => r.type === "phq9").map(r => r.score);
    
    return {
      totalAssessments: filteredData.length,
      averageGAD7: gad7Scores.length > 0 ? gad7Scores.reduce((a, b) => a + b, 0) / gad7Scores.length : 0,
      averagePHQ9: phq9Scores.length > 0 ? phq9Scores.reduce((a, b) => a + b, 0) / phq9Scores.length : 0,
      lastAssessment: filteredData.length > 0 ? new Date(filteredData[0].completedAt) : null,
    };
  }, [filteredData]);

  const getSeverityColor = (type: AssessmentType, score: number) => {
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
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t("backToAssessments")}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {t("exportHistory")}
          </Button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {t("history.title")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("history.subtitle")}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.totalAssessments}</div>
                <div className="text-sm text-muted-foreground">{t("history.totalAssessments")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{stats.averageGAD7.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">{t("history.averageGAD7")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{stats.averagePHQ9.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">{t("history.averagePHQ9")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-lg font-bold">
                  {stats.lastAssessment ? formatDate(stats.lastAssessment.toISOString()) : t("history.noAssessments")}
                </div>
                <div className="text-sm text-muted-foreground">{t("history.lastAssessment")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("history.trends")}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                {t("history.all")}
              </Button>
              <Button
                variant={filter === "gad7" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("gad7")}
              >
                GAD-7
              </Button>
              <Button
                variant={filter === "phq9" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("phq9")}
              >
                PHQ-9
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: any, name: any) => [
                    value,
                    name === "gad7" ? "GAD-7" : "PHQ-9"
                  ]}
                />
                {(filter === "all" || filter === "gad7") && (
                  <Area
                    type="monotone"
                    dataKey="gad7"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                    connectNulls
                  />
                )}
                {(filter === "all" || filter === "phq9") && (
                  <Area
                    type="monotone"
                    dataKey="phq9"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    strokeWidth={2}
                    connectNulls
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("history.recentAssessments")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("history.noAssessmentsFound")}</p>
                <div className="mt-4 space-x-2">
                  <Button onClick={() => onStartAssessment("gad7")}>
                    {t("startGAD7")}
                  </Button>
                  <Button variant="outline" onClick={() => onStartAssessment("phq9")}>
                    {t("startPHQ9")}
                  </Button>
                </div>
              </div>
            ) : (
              filteredData.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      record.type === "gad7" ? "bg-blue-100" : "bg-green-100"
                    }`}>
                      {record.type === "gad7" ? (
                        <Brain className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Heart className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {record.type === "gad7" ? "GAD-7" : "PHQ-9"} {t("assessment")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(record.completedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold">Score: {record.score}</div>
                      <Badge className={getSeverityColor(record.type, record.score)}>
                        {record.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
