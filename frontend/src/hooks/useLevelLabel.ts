"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

const KNOWN_LEVELS = new Set([
  "minimal",
  "mild",
  "moderate",
  "moderately_severe",
  "severe",
  "low",
  "high",
  "very_high",
]);

/**
 * Localised display label for a backend `feedback_level` string. For unknown
 * values, falls back to titlecasing the raw string so we never render a blank
 * pill (e.g. a future instrument adds a level we haven't translated yet).
 */
export function useLevelLabel() {
  const t = useTranslations("assessments.levels");
  return useCallback(
    (level: string) => {
      if (KNOWN_LEVELS.has(level)) return t(level);
      return level.charAt(0).toUpperCase() + level.slice(1).replace(/_/g, " ");
    },
    [t],
  );
}
