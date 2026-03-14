"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MoodCheckIn from "@/components/mood/MoodCheckIn";
import MoodLineChart from "@/components/mood/MoodLineChart";
import MoodCalendarHeatmap from "@/components/mood/MoodCalendarHeatmap";
import MoodStatsCards from "@/components/mood/MoodStatsCards";
import MoodDistribution from "@/components/mood/MoodDistribution";
import BadgeCollection from "@/components/mood/BadgeCollection";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useMoodData } from "@/hooks/useMoodData";
import type { MoodEntryResponse, BadgeResponse } from "@/lib/api";

export default function MoodPage() {
  const t = useTranslations("mood");
  const [refreshKey, setRefreshKey] = useState(0);
  const { stats, badges, isLoading, refresh } = useMoodData(90);
  const chartSectionRef = useRef<HTMLDivElement>(null);

  const handleEntryCreated = useCallback(
    (entry: MoodEntryResponse, newBadges: BadgeResponse[]) => {
      toast({
        title: t("logged"),
        description:
          newBadges.length > 0
            ? `${t("badgeEarned")} ${newBadges.map((b) => `${b.icon} ${b.name}`).join(", ")}`
            : undefined,
      });
      refresh();
      setRefreshKey((k) => k + 1);

      // Scroll to charts — after badge celebration if badges were earned
      const delay = newBadges.length > 0 ? 5500 : 400;
      setTimeout(() => {
        chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, delay);
    },
    [t, refresh]
  );

  const isEmpty = !isLoading && (stats?.total_entries ?? 0) === 0;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Page title */}
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

        {/* Mood check-in — full (not compact) */}
        <MoodCheckIn onEntryCreated={handleEntryCreated} />

        {/* Tabbed charts */}
        <div ref={chartSectionRef}>
          <Tabs defaultValue="trends">
            <TabsList className="w-full">
              <TabsTrigger value="trends" className="flex-1">
                {t("trends")}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex-1">
                {t("calendar")}
              </TabsTrigger>
            </TabsList>

            {/* Recharts re-mounts cleanly when key changes after a new entry */}
            <TabsContent value="trends" className="mt-4">
              <MoodLineChart key={refreshKey} />
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <MoodCalendarHeatmap key={refreshKey} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Stats cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-border bg-card/50 p-8 text-center">
            <span className="text-4xl block mb-3">📊</span>
            <p className="text-sm font-semibold text-foreground mb-1">{t("noStatsYet")}</p>
            <p className="text-xs text-muted-foreground">{t("completeFirstCheckIn")}</p>
          </div>
        ) : stats ? (
          <>
            <MoodStatsCards stats={stats} />
            <MoodDistribution stats={stats} />
          </>
        ) : null}

        {/* Badge collection */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <BadgeCollection badges={badges} />
        )}
      </div>
    </div>
  );
}
