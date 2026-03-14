"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BadgeResponse } from "@/lib/api";

interface Props {
  badges: BadgeResponse[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function BadgeCollection({ badges }: Props) {
  const t = useTranslations("mood");

  if (badges.length === 0) return null;

  const earned = badges.filter((b) => b.is_earned);
  const locked = badges.filter((b) => !b.is_earned);
  const sorted = [...earned, ...locked];

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-4">
        {t("yourBadges")}
        {earned.length > 0 && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {earned.length} / {badges.length}
          </span>
        )}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {sorted.map((badge) => (
          <BadgeCard key={badge.badge_id} badge={badge} t={t} />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ badge, t }: { badge: BadgeResponse; t: ReturnType<typeof useTranslations> }) {
  if (badge.is_earned) {
    return (
      <div className="relative rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-primary/20 transition-shadow hover:shadow-md">
        {/* Subtle earned glow */}
        <div className="absolute inset-0 rounded-2xl bg-primary/3 pointer-events-none" />
        <div className="relative">
          <span className="text-3xl leading-none block mb-2">{badge.icon}</span>
          <p className="text-sm font-semibold text-foreground leading-tight">{badge.name}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
            {badge.description}
          </p>
          {badge.earned_at && (
            <p className="text-xs text-primary font-medium mt-2">
              {t("earnedOn", { date: formatDate(badge.earned_at) })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-border bg-card p-4 shadow-sm opacity-50">
      <div className="absolute top-3 right-3">
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <span className="text-3xl leading-none block mb-2 grayscale">{badge.icon}</span>
      <p className="text-sm font-semibold text-muted-foreground leading-tight">{badge.name}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">
        {badge.description}
      </p>
      <p className="text-xs text-muted-foreground/70 mt-2">{t("lockedBadge")}</p>
    </div>
  );
}
