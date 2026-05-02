"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import type { BadgeResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  badges: BadgeResponse[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function BadgeCollection({ badges }: Props) {
  const t = useTranslations("mood");
  if (badges.length === 0) return null;

  const earned = badges.filter((b) => b.is_earned);
  const locked = badges.filter((b) => !b.is_earned);
  const sorted = [...earned, ...locked];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="font-serif text-xl tracking-tight text-foreground">{t("yourBadges")}</h3>
        {earned.length > 0 && (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {earned.length} / {badges.length}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {sorted.map((badge) => (
          <BadgeCard key={badge.badge_id} badge={badge} t={t} />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({
  badge,
  t,
}: {
  badge: BadgeResponse;
  t: ReturnType<typeof useTranslations>;
}) {
  const earned = badge.is_earned;
  return (
    <div
      className={cn(
        "relative rounded-xl border p-4 transition-all",
        earned
          ? "border-primary/20 bg-gradient-to-b from-primary/5 to-card hover:-translate-y-0.5 hover:shadow-soft-sm"
          : "border-dashed border-border bg-muted/40",
      )}
    >
      {!earned && (
        <Lock
          className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground"
          strokeWidth={1.75}
        />
      )}
      <span
        className={cn(
          "block text-3xl leading-none",
          earned ? "" : "grayscale opacity-50",
        )}
      >
        {badge.icon}
      </span>
      <p
        className={cn(
          "mt-3 text-sm font-semibold leading-tight",
          earned ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {badge.name}
      </p>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
        {badge.description}
      </p>
      {earned && badge.earned_at && (
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-primary">
          {t("earnedOn", { date: formatDate(badge.earned_at) })}
        </p>
      )}
      {!earned && (
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground/80">
          {t("lockedBadge")}
        </p>
      )}
    </div>
  );
}
