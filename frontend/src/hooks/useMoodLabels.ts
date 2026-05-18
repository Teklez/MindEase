"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  MOOD_EMOJI,
  clampMood,
  type MoodScore,
} from "@/lib/mood";

const KEY_BY_SCORE: Record<MoodScore, "awful" | "low" | "okay" | "good" | "great"> = {
  1: "awful",
  2: "low",
  3: "okay",
  4: "good",
  5: "great",
};

const SCORES: MoodScore[] = [1, 2, 3, 4, 5];

export type LocalizedMoodOption = {
  score: MoodScore;
  label: string;
  emoji: string;
};

export function useMoodLabels() {
  const t = useTranslations("mood.scores");
  return useMemo(() => {
    const getMoodLabel = (score: number) => t(KEY_BY_SCORE[clampMood(score)]);
    const moodOptions: LocalizedMoodOption[] = SCORES.map((s) => ({
      score: s,
      label: t(KEY_BY_SCORE[s]),
      emoji: MOOD_EMOJI[s],
    }));
    return { getMoodLabel, moodOptions };
  }, [t]);
}
