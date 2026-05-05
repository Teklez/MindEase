"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";

type AssessmentType = "gad7" | "phq9";

interface Question {
  id: string;
  text: string;
  options: Array<{
    value: number;
    label: string;
    description: string;
  }>;
}

interface QuestionnaireFlowProps {
  type: AssessmentType;
  onComplete: (result: any) => void;
  onCancel: () => void;
}

const GAD7_QUESTIONS: Question[] = [
  {
    id: "nervous",
    text: "Feeling nervous, anxious, or on edge",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "control",
    text: "Not being able to stop or control worrying",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "worrying",
    text: "Worrying too much about different things",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "relaxation",
    text: "Trouble relaxing",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "restless",
    text: "Being so restless that it is hard to sit still",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "annoyed",
    text: "Becoming easily annoyed or irritable",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "afraid",
    text: "Feeling afraid, as if something awful might happen",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
];

const PHQ9_QUESTIONS: Question[] = [
  {
    id: "interest",
    text: "Little interest or pleasure in doing things",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "mood",
    text: "Feeling down, depressed, or hopeless",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "sleep",
    text: "Trouble falling or staying asleep, or sleeping too much",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "energy",
    text: "Feeling tired or having little energy",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "appetite",
    text: "Poor appetite or overeating",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "failure",
    text: "Feeling bad about yourself—or that you are a failure or have let yourself or your family down",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "concentration",
    text: "Trouble concentrating on things, such as reading the newspaper or watching television",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "movement",
    text: "Moving or speaking so slowly that other people could have noticed? Or the opposite—being so fidgety or restless that you have been moving around a lot more than usual",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
  {
    id: "harm",
    text: "Thoughts that you would be better off dead, or of hurting yourself in some way",
    options: [
      { value: 0, label: "Not at all", description: "Never" },
      { value: 1, label: "Several days", description: "Sometimes" },
      { value: 2, label: "More than half the days", description: "Often" },
      { value: 3, label: "Nearly every day", description: "Almost always" },
    ],
  },
];

export default function QuestionnaireFlow({ type, onComplete, onCancel }: QuestionnaireFlowProps) {
  const t = useTranslations("assessment");
  const questions = type === "gad7" ? GAD7_QUESTIONS : PHQ9_QUESTIONS;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswer = (value: number) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    if (isLastQuestion) {
      // Calculate total score
      const totalScore = Object.values(newAnswers).reduce((sum, value) => sum + value, 0);
      onComplete({
        type,
        score: totalScore,
        answers: newAnswers,
        completedAt: new Date().toISOString(),
      });
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onCancel} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          {t("cancel")}
        </Button>
        <div className="text-sm text-muted-foreground">
          {t("questionProgress", { current: currentQuestionIndex + 1, total: questions.length })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{t("progressStarted")}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Question Card */}
      <Card className="w-full">
        <CardContent className="p-6 md:p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {currentQuestion.text}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("overTheLastTwoWeeks")}
              </p>
            </div>

            {/* Answer Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <Button
                  key={option.value}
                  variant="outline"
                  className="w-full justify-start text-left h-auto p-4 hover:bg-primary/5 hover:border-primary/20 transition-colors"
                  onClick={() => handleAnswer(option.value)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        answers[currentQuestion.id] === option.value
                          ? "bg-primary border-primary"
                          : "border-muted-foreground"
                      }`} />
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("previous")}
        </Button>
        <div className="text-sm text-muted-foreground">
          {t("questionCount", { current: currentQuestionIndex + 1, total: questions.length })}
        </div>
      </div>
    </div>
  );
}
