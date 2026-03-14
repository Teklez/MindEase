"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { createMoodEntry, type MoodEntryResponse, type BadgeResponse } from "@/lib/api";
import BadgeCelebration from "./BadgeCelebration";

const MOODS = [
  { level: 1, emoji: "😢", labelKey: "veryBad" },
  { level: 2, emoji: "😕", labelKey: "bad" },
  { level: 3, emoji: "😐", labelKey: "neutral" },
  { level: 4, emoji: "🙂", labelKey: "good" },
  { level: 5, emoji: "😄", labelKey: "veryGood" },
] as const;

// Static classes to avoid Tailwind purging
const MOOD_STYLES = {
  1: {
    selectedBg: "bg-red-100 dark:bg-red-950/50",
    ring: "ring-red-400 dark:ring-red-500",
    cardTint: "bg-red-50/60 dark:bg-red-950/20",
    label: "text-red-600 dark:text-red-400",
    hover: "hover:bg-red-50 dark:hover:bg-red-950/30",
  },
  2: {
    selectedBg: "bg-orange-100 dark:bg-orange-950/50",
    ring: "ring-orange-400 dark:ring-orange-500",
    cardTint: "bg-orange-50/60 dark:bg-orange-950/20",
    label: "text-orange-600 dark:text-orange-400",
    hover: "hover:bg-orange-50 dark:hover:bg-orange-950/30",
  },
  3: {
    selectedBg: "bg-yellow-100 dark:bg-yellow-950/50",
    ring: "ring-yellow-400 dark:ring-yellow-500",
    cardTint: "bg-yellow-50/60 dark:bg-yellow-950/20",
    label: "text-yellow-600 dark:text-yellow-400",
    hover: "hover:bg-yellow-50 dark:hover:bg-yellow-950/30",
  },
  4: {
    selectedBg: "bg-green-100 dark:bg-green-950/50",
    ring: "ring-green-400 dark:ring-green-500",
    cardTint: "bg-green-50/60 dark:bg-green-950/20",
    label: "text-green-600 dark:text-green-400",
    hover: "hover:bg-green-50 dark:hover:bg-green-950/30",
  },
  5: {
    selectedBg: "bg-emerald-100 dark:bg-emerald-950/50",
    ring: "ring-emerald-400 dark:ring-emerald-500",
    cardTint: "bg-emerald-50/60 dark:bg-emerald-950/20",
    label: "text-emerald-600 dark:text-emerald-400",
    hover: "hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
  },
} as const;

interface Props {
  compact?: boolean;
  onEntryCreated?: (entry: MoodEntryResponse, newBadges: BadgeResponse[]) => void;
}

export default function MoodCheckIn({ compact = false, onEntryCreated }: Props) {
  const t = useTranslations("mood");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrationBadges, setCelebrationBadges] = useState<BadgeResponse[]>([]);

  const moodStyles = selectedMood ? MOOD_STYLES[selectedMood as keyof typeof MOOD_STYLES] : null;

  async function handleSave() {
    if (!selectedMood || saving || saved) return;
    setSaving(true);
    setError(null);

    const res = await createMoodEntry(
      selectedMood,
      !compact && note.trim() ? note.trim() : undefined
    );
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? "Failed to save");
      return;
    }

    const { entry, new_badges } = res.data;
    setSaved(true);
    onEntryCreated?.(entry, new_badges);

    if (new_badges.length > 0) {
      navigator.vibrate?.([50, 30, 50]);
      setCelebrationBadges(new_badges);
    }

    setTimeout(() => {
      setSaved(false);
      setSelectedMood(null);
      setNote("");
    }, 2000);
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-border shadow-sm transition-colors duration-500",
          compact ? "p-4" : "p-5",
          selectedMood ? moodStyles!.cardTint : "bg-card"
        )}
      >
        <h2
          className={cn(
            "font-semibold text-foreground",
            compact ? "text-sm mb-3" : "text-base mb-4"
          )}
        >
          {t("checkIn")}
        </h2>

        {/* Emoji mood selector */}
        <div className="flex gap-1 justify-between">
          {MOODS.map((mood) => {
            const styles = MOOD_STYLES[mood.level];
            const isSelected = selectedMood === mood.level;
            const isDimmed = selectedMood !== null && !isSelected;

            return (
              <button
                key={mood.level}
                onClick={() => { if (!saved) { setSelectedMood(mood.level); navigator.vibrate?.(10); } }}
                aria-label={t(mood.labelKey)}
                aria-pressed={isSelected}
                disabled={saved}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-xl transition-all duration-200",
                  "flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  compact ? "p-2" : "p-2.5",
                  isSelected
                    ? [styles.selectedBg, "ring-2", styles.ring]
                    : [styles.hover, "ring-2 ring-transparent"],
                  isDimmed && "opacity-40",
                  saved && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "leading-none select-none inline-block transition-all duration-200",
                    compact ? "text-3xl" : "text-4xl",
                    isSelected && (compact ? "scale-125" : "scale-125"),
                    !isSelected && "grayscale group-hover:grayscale-0 group-hover:scale-110"
                  )}
                >
                  {mood.emoji}
                </span>
                {!compact && (
                  <span
                    className={cn(
                      "text-xs font-medium transition-colors duration-200",
                      isSelected ? styles.label : "text-muted-foreground"
                    )}
                  >
                    {t(mood.labelKey)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Note textarea — full mode only, slides down after mood selected */}
        {!compact && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              selectedMood && !saved ? "max-h-36 opacity-100 mt-4" : "max-h-0 opacity-0"
            )}
          >
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 280))}
                placeholder={t("addNote")}
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
              />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground tabular-nums">
                {note.length}/280
              </span>
            </div>
          </div>
        )}

        {/* Save / success state */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            selectedMood ? "max-h-24 opacity-100 mt-4" : "max-h-0 opacity-0"
          )}
        >
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              "w-full rounded-xl px-4 font-medium transition-all duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "py-2 text-sm" : "py-2.5 text-sm",
              saved
                ? "bg-green-500 text-white cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
            )}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("saving")}
              </span>
            ) : saved ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {t("logged")}
              </span>
            ) : (
              t("save")
            )}
          </button>
        </div>
      </div>

      {celebrationBadges.length > 0 && (
        <BadgeCelebration
          badges={celebrationBadges}
          onClose={() => setCelebrationBadges([])}
        />
      )}
    </>
  );
}
