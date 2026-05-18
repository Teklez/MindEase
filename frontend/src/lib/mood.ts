export type MoodScore = 1 | 2 | 3 | 4 | 5;

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

export function getMoodEmoji(score: number): string {
  return MOOD_EMOJI[clampMood(score)];
}

export function getMoodColor(score: number): string {
  return MOOD_VARS[clampMood(score)];
}
