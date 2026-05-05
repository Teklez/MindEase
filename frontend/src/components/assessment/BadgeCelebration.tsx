"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Sparkles, Star, Award, Brain, TrendingUp } from "lucide-react";

interface BadgeCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  badgeType: "self-aware" | "consistent" | "improving";
  userName?: string;
}

interface BadgeInfo {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const BADGE_INFO: Record<string, BadgeInfo> = {
  "self-aware": {
    icon: <Brain className="h-8 w-8" />,
    title: "Self-Aware",
    description: "You've completed your first mental health assessment! Taking this step shows self-awareness and commitment to your wellbeing.",
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  "consistent": {
    icon: <Trophy className="h-8 w-8" />,
    title: "Consistent Tracker",
    description: "You've completed multiple assessments! Regular check-ins help you understand your mental health patterns.",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50"
  },
  "improving": {
    icon: <TrendingUp className="h-8 w-8" />,
    title: "On the Rise",
    description: "Your assessment scores show improvement! Keep up the great work on your mental health journey.",
    color: "text-green-600",
    bgColor: "bg-green-50"
  }
};

export default function BadgeCelebration({ isOpen, onClose, badgeType, userName }: BadgeCelebrationProps) {
  const t = useTranslations("assessment");
  const [showConfetti, setShowConfetti] = useState(false);
  const badgeInfo = BADGE_INFO[badgeType];

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!badgeInfo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <DialogTitle className="sr-only">Badge Celebration</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Confetti Effect */}
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute animate-bounce"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`
                  }}
                >
                  {["🎉", "⭐", "✨", "🎊", "🌟"][Math.floor(Math.random() * 5)]}
                </div>
              ))}
            </div>
          )}

          {/* Badge Display */}
          <div className="relative">
            <div className={`mx-auto w-24 h-24 rounded-full ${badgeInfo.bgColor} flex items-center justify-center ${badgeInfo.color} relative`}>
              {badgeInfo.icon}
              <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-yellow-500 animate-pulse" />
              <Star className="absolute -bottom-1 -left-1 h-5 w-5 text-yellow-500 animate-pulse" />
            </div>
          </div>

          {/* Badge Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <h2 className="text-2xl font-bold text-foreground">Badge Earned!</h2>
              <Award className="h-5 w-5 text-yellow-500" />
            </div>
            
            <h3 className="text-xl font-semibold text-foreground">
              {badgeInfo.title}
            </h3>
            
            <p className="text-muted-foreground leading-relaxed">
              {badgeInfo.description}
            </p>

            {userName && (
              <p className="text-sm text-muted-foreground">
                Congratulations, {userName}! 🎉
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button onClick={onClose} className="w-full">
              Awesome, Thanks!
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full">
              View All Badges
            </Button>
          </div>

          {/* Progress Hint */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4" />
                <span>Keep completing assessments to unlock more badges!</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

