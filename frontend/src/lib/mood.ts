export type MoodScore = 1 | 2 | 3 | 4 | 5;

export const MOOD_LABELS: Record<MoodScore, string> = {
  1: "Awful",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

export const MOOD_EMOJI: Record<MoodScore, string> = {
  1: "😞",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😊",
};

const MOOD_VARS: Record<MoodScore, string> = {
  1: "var(--mood-1)",
  2: "var(--mood-2)",
  3: "var(--mood-3)",
  4: "var(--mood-4)",
  5: "var(--mood-5)",
};

export function clampMood(score: number): MoodScore {
  const n = Math.round(score);
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as MoodScore;
}

export function getMoodLabel(score: number): string {
  return MOOD_LABELS[clampMood(score)];
}

export function getMoodEmoji(score: number): string {
  return MOOD_EMOJI[clampMood(score)];
}

export function getMoodColor(score: number): string {
  return MOOD_VARS[clampMood(score)];
}

export const MOOD_OPTIONS: Array<{ score: MoodScore; label: string; emoji: string }> = [
  { score: 1, label: MOOD_LABELS[1], emoji: MOOD_EMOJI[1] },
  { score: 2, label: MOOD_LABELS[2], emoji: MOOD_EMOJI[2] },
  { score: 3, label: MOOD_LABELS[3], emoji: MOOD_EMOJI[3] },
  { score: 4, label: MOOD_LABELS[4], emoji: MOOD_EMOJI[4] },
  { score: 5, label: MOOD_LABELS[5], emoji: MOOD_EMOJI[5] },
];
