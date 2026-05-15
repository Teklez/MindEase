/**
 * Maps assessment severity levels to the unified 5-point gentle scale
 * (moss → sage-honey → sand → warm clay → clay).
 *
 * Why a 5-point scale instead of red→green: mental-health severity isn't
 * morally graded. A "severe" reading should feel like attention, not failure.
 */

export type LevelIndex = 1 | 2 | 3 | 4 | 5;

/**
 * Normalize backend feedback_level strings to a 1..5 index. Backend uses
 * several conventions across instruments (e.g. PSS uses low/moderate/high/
 * very_high; PHQ-9 uses minimal/mild/moderate/moderately_severe/severe).
 */
export function levelToIndex(level: string): LevelIndex {
  switch (level) {
    case "minimal":
    case "low":
      return 1;
    case "mild":
      return 2;
    case "moderate":
      return 3;
    case "moderately_severe":
    case "high":
      return 4;
    case "severe":
    case "very_high":
      return 5;
    default:
      return 3;
  }
}

export function levelVar(level: string): string {
  return `var(--lvl-${levelToIndex(level)})`;
}

export function levelTextClass(level: string): string {
  return `text-level-${levelToIndex(level)}`;
}

export function levelBorderClass(level: string): string {
  return `border-level-${levelToIndex(level)}`;
}

/** Friendly display label for any backend feedback_level. */
export function levelLabel(level: string): string {
  switch (level) {
    case "minimal":
      return "Minimal";
    case "mild":
      return "Mild";
    case "moderate":
      return "Moderate";
    case "moderately_severe":
      return "Mod-severe";
    case "severe":
      return "Severe";
    case "low":
      return "Low";
    case "high":
      return "High";
    case "very_high":
      return "Very high";
    default:
      return level.charAt(0).toUpperCase() + level.slice(1).replace("_", " ");
  }
}

/** Short instrument code per assessment_type. Falls back to the type itself. */
export function instrumentCode(assessmentType: string): string {
  switch (assessmentType) {
    case "depression":
      return "PHQ-9";
    case "anxiety":
      return "GAD-7";
    case "stress":
      return "PSS";
    default:
      return assessmentType.toUpperCase();
  }
}

/** Color family per assessment_type — drives card tints + trend strokes. */
export function instrumentTone(assessmentType: string): "sage" | "honey" | "dawn" {
  switch (assessmentType) {
    case "depression":
      return "sage";
    case "anxiety":
      return "honey";
    case "stress":
      return "dawn";
    default:
      return "sage";
  }
}
