"use client";

import { useTranslations } from "next-intl";
import { Award, Lock } from "lucide-react";
import type { BadgeResponse } from "@/lib/api";

type Props = {
  badges?: BadgeResponse[];
};

type SampleEarned = { name: string; earned: string };
type SampleLocked = { name: string; hint: string };

export default function BadgesPanel({ badges }: Props) {
  const t = useTranslations("dashboard.v2.badges");

  // Prefer real badges if any are earned; otherwise fall back to the
  // sample copy from i18n so the panel never looks empty in dev.
  const realEarned = (badges ?? []).filter((b) => b.is_earned);
  const useFallback = realEarned.length === 0;

  const sampleEarned = t.raw("sample") as SampleEarned[];
  const lockedSample = t.raw("lockedSample") as SampleLocked;

  const earnedItems = useFallback
    ? sampleEarned
    : realEarned.slice(0, 3).map((b) => ({
        name: b.name,
        earned: b.earned_at
          ? t("earnedOn", {
              date: new Date(b.earned_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }),
            })
          : "",
      }));

  const totalCount = badges?.length ?? 12;
  const earnedCount = realEarned.length || sampleEarned.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-serif text-[20px] font-[360] tracking-[-0.01em] text-foreground">
          {t("title")}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {t("progress", { earned: earnedCount, total: totalCount })}
        </span>
      </header>
      <div className="flex flex-col gap-3.5 px-6 py-4">
        {earnedItems.map((item, i) => (
          <div key={i} className="flex items-center gap-3.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Award className="h-4 w-4" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[14px] font-medium text-foreground">{item.name}</div>
              <div className="text-[12.5px] text-muted-foreground">{item.earned}</div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3.5 opacity-60">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
            <Lock className="h-4 w-4" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[14px] font-medium text-foreground">
              {lockedSample.name}
            </div>
            <div className="text-[12.5px] text-muted-foreground">{lockedSample.hint}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
