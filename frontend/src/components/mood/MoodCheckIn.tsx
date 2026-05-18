"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Check } from "lucide-react";
import { createMoodEntry, type MoodEntryResponse, type BadgeResponse } from "@/lib/api";
import { getMoodColor } from "@/lib/mood";
import { useMoodLabels } from "@/hooks/useMoodLabels";
import { cn } from "@/lib/utils";
import BadgeCelebration from "./BadgeCelebration";

type Props = {
  compact?: boolean;
  onEntryCreated?: (entry: MoodEntryResponse, newBadges: BadgeResponse[]) => void;
};

export default function MoodCheckIn({ compact = false, onEntryCreated }: Props) {
  const t = useTranslations("mood");
  const { getMoodLabel, moodOptions } = useMoodLabels();
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrationBadges, setCelebrationBadges] = useState<BadgeResponse[]>([]);

  async function handleSave() {
    if (!selected || saving || saved) return;
    setSaving(true);
    setError(null);
    const res = await createMoodEntry(selected, !compact && note.trim() ? note.trim() : undefined);
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
      setSelected(null);
      setNote("");
    }, 2000);
  }

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-border bg-card shadow-soft-sm",
          compact ? "p-4" : "p-6",
        )}
      >
        {!compact && (
          <h3 className="font-serif text-xl tracking-tight text-foreground">{t("checkIn")}</h3>
        )}

        <div className={cn("grid grid-cols-5 gap-2", !compact && "mt-5")}>
          {moodOptions.map((m) => {
            const active = selected === m.score;
            return (
              <button
                key={m.score}
                type="button"
                onClick={() => !saved && setSelected(m.score)}
                disabled={saved}
                aria-pressed={active}
                aria-label={getMoodLabel(m.score)}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-transparent shadow-soft-sm -translate-y-0.5"
                    : "border-border bg-background hover:-translate-y-0.5 hover:shadow-soft-sm",
                  selected && !active && "opacity-50",
                )}
                style={
                  active
                    ? { backgroundColor: getMoodColor(m.score), color: "white" }
                    : undefined
                }
              >
                <span className={cn("text-2xl leading-none", compact ? "text-2xl" : "text-3xl")}>
                  {m.emoji}
                </span>
                {!compact && (
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      active ? "text-white" : "text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!compact && (
          <div
            className={cn(
              "overflow-hidden transition-all",
              selected && !saved ? "max-h-40 opacity-100 mt-4" : "max-h-0 opacity-0",
            )}
          >
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 280))}
                placeholder={t("addNote")}
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="absolute bottom-2 right-3 text-[11px] tabular-nums text-muted-foreground">
                {note.length}/280
              </span>
            </div>
          </div>
        )}

        <div
          className={cn(
            "overflow-hidden transition-all",
            selected ? "max-h-24 opacity-100 mt-4" : "max-h-0 opacity-0",
          )}
        >
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              saved
                ? "bg-success text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70",
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t("saving")}
              </>
            ) : saved ? (
              <>
                <Check className="h-4 w-4" /> {t("logged")}
              </>
            ) : (
              t("save")
            )}
          </button>
        </div>
      </div>

      {celebrationBadges.length > 0 && (
        <BadgeCelebration badges={celebrationBadges} onClose={() => setCelebrationBadges([])} />
      )}
    </>
  );
}
