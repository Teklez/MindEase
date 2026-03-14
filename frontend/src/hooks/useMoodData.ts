"use client";

import { useCallback, useEffect, useState } from "react";
import { getMoodHistory, getMoodBadges, type BadgeResponse } from "@/lib/api";
import type { MoodHistoryResponse, MoodStats, MoodTrend, MoodDayAggregate } from "@/lib/types";

interface MoodData {
  history: MoodHistoryResponse | null;
  stats: MoodStats | null;
  trends: MoodTrend[];
  calendarData: MoodDayAggregate[];
  badges: BadgeResponse[];
  isLoading: boolean;
  refresh: () => void;
}

export function useMoodData(days: number = 90): MoodData {
  const [history, setHistory] = useState<MoodHistoryResponse | null>(null);
  const [badges, setBadges] = useState<BadgeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    const [histRes, badgesRes] = await Promise.all([
      getMoodHistory(days),
      getMoodBadges(),
    ]);
    setIsLoading(false);
    if (histRes.ok) setHistory(histRes.data);
    if (badgesRes.ok) setBadges(badgesRes.data);
  }, [days]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    history,
    stats: history?.stats ?? null,
    trends: history?.daily_trends ?? [],
    calendarData: history?.calendar_data ?? [],
    badges,
    isLoading,
    refresh: fetch,
  };
}
