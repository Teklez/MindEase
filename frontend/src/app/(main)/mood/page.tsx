"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import MoodCheckIn from "@/components/mood/MoodCheckIn";
import MoodLineChart from "@/components/mood/MoodLineChart";
import MoodCalendarHeatmap from "@/components/mood/MoodCalendarHeatmap";
import MoodStatsCards from "@/components/mood/MoodStatsCards";
import MoodDistribution from "@/components/mood/MoodDistribution";
import BadgeCollection from "@/components/mood/BadgeCollection";
import { useMoodData } from "@/hooks/useMoodData";
import { toast } from "@/hooks/use-toast";
import type { BadgeResponse, MoodEntryResponse } from "@/lib/api";

export default function MoodPage() {
  const t = useTranslations("mood");
  const { stats, badges, isLoading, refresh } = useMoodData(90);
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const handleEntryCreated = useCallback(
    (_entry: MoodEntryResponse, newBadges: BadgeResponse[]) => {
      toast({
        title: t("logged"),
        description:
          newBadges.length > 0
            ? `${t("badgeEarned")} ${newBadges.map((b) => `${b.icon} ${b.name}`).join(", ")}`
            : undefined,
      });
      refresh();
      setRefreshKey((k) => k + 1);
      setTimeout(() => setCheckInOpen(false), newBadges.length > 0 ? 5500 : 1200);
    },
    [t, refresh],
  );

  const isEmpty = !isLoading && (stats?.total_entries ?? 0) === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[36px] leading-[1.08] tracking-tight text-foreground md:text-[44px]">
            {t("title")}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{t("checkIn")}</p>
        </div>
        <div className="flex items-center gap-2">
<button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary/90 shadow-soft-sm"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            {t("logMood")}
          </button>
        </div>
      </header>

      <div className="mt-8 space-y-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-serif text-2xl tracking-tight text-foreground">{t("noStatsYet")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("completeFirstCheckIn")}</p>
          </div>
        ) : stats ? (
          <MoodStatsCards stats={stats} />
        ) : null}

        <Tabs defaultValue="trends" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-4 rounded-full bg-muted p-1">
            <TabsTrigger value="trends" className="rounded-full">
              {t("trends")}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-full">
              {t("calendar")}
            </TabsTrigger>
            <TabsTrigger value="distribution" className="rounded-full">
              {t("distribution")}
            </TabsTrigger>
            <TabsTrigger value="badges" className="rounded-full">
              {t("yourBadges")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="mt-5">
            <MoodLineChart key={`trends-${refreshKey}`} />
          </TabsContent>

          <TabsContent value="calendar" className="mt-5">
            <MoodCalendarHeatmap key={`cal-${refreshKey}`} />
          </TabsContent>

          <TabsContent value="distribution" className="mt-5">
            {stats ? (
              <MoodDistribution stats={stats} />
            ) : (
              <Skeleton className="h-72 rounded-2xl" />
            )}
          </TabsContent>

          <TabsContent value="badges" className="mt-5">
            <BadgeCollection badges={badges} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl tracking-tight">{t("checkIn")}</DialogTitle>
          </DialogHeader>
          <MoodCheckIn onEntryCreated={handleEntryCreated} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
