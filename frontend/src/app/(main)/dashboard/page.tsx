"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getChatConversations,
  getMe,
  getMoodBadges,
  getMoodHistory,
  getStoredToken,
  type BadgeResponse,
} from "@/lib/api";
import type { Conversation, MoodStats, MoodTrend } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import GreetingHero from "@/components/dashboard/GreetingHero";
import MoodCheckInCard from "@/components/dashboard/MoodCheckInCard";
import StatCards from "@/components/dashboard/StatCards";
import StartChatCTA from "@/components/dashboard/StartChatCTA";
import RecentConversations from "@/components/dashboard/RecentConversations";
import QuickActions from "@/components/dashboard/QuickActions";
import MoodSparkline from "@/components/dashboard/MoodSparkline";
import DailyReflection from "@/components/dashboard/DailyReflection";
import BadgesPanel from "@/components/dashboard/BadgesPanel";

const DAY_MS = 24 * 60 * 60 * 1000;

function countSince(conversations: Conversation[], windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return conversations.filter((c) => new Date(c.last_message_at).getTime() >= cutoff).length;
}

function countWithinPrevious(
  conversations: Conversation[],
  fromMs: number,
  toMs: number,
): number {
  const now = Date.now();
  return conversations.filter((c) => {
    const t = new Date(c.last_message_at).getTime();
    return t >= now - fromMs && t < now - toMs;
  }).length;
}

export default function DashboardPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [trends, setTrends] = useState<MoodTrend[]>([]);
  const [stats, setStats] = useState<MoodStats | null>(null);
  const [badges, setBadges] = useState<BadgeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [moodVersion, setMoodVersion] = useState(0);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    Promise.all([
      getMe(),
      getChatConversations(),
      getMoodHistory(30),
      getMoodBadges(),
    ]).then(([meRes, convRes, moodRes, badgesRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (!meRes.ok) {
        if (meRes.status === 401) router.replace("/login");
        return;
      }
      setDisplayName(meRes.data.display_name);
      if (convRes.ok) setConversations(convRes.data as Conversation[]);
      if (moodRes.ok) {
        setTrends(moodRes.data.daily_trends);
        setStats(moodRes.data.stats);
      }
      if (badgesRes.ok) setBadges(badgesRes.data);
    });
    return () => {
      cancelled = true;
    };
  }, [router, moodVersion]);

  const derivedStats = useMemo(() => {
    const totalConversations = conversations.length;
    const conversationsThisMonth = countSince(conversations, 30 * DAY_MS);
    const sessionsThisWeek = countSince(conversations, 7 * DAY_MS);
    const sessionsPrevWeek = countWithinPrevious(conversations, 14 * DAY_MS, 7 * DAY_MS);
    return {
      totalConversations,
      conversationsThisMonth,
      sessionsThisWeek,
      weekDelta: sessionsThisWeek - sessionsPrevWeek,
    };
  }, [conversations]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-9 md:px-9">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-32 rounded-2xl" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (displayName === null) return null;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-9 md:px-9">
      <DashboardHeader />
      <div className="mt-7">
        <GreetingHero displayName={displayName} streak={stats?.current_streak ?? 0} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <MoodCheckInCard onMoodLogged={() => setMoodVersion((v) => v + 1)} />
          <StatCards
            totalConversations={derivedStats.totalConversations}
            conversationsThisMonth={derivedStats.conversationsThisMonth}
            sessionsThisWeek={derivedStats.sessionsThisWeek}
            weekDelta={derivedStats.weekDelta}
            currentStreak={stats?.current_streak ?? 0}
            longestStreak={stats?.longest_streak ?? 0}
          />
          <StartChatCTA />
          <RecentConversations conversations={conversations} />
          <QuickActions />
        </div>
        <div className="flex flex-col gap-6">
          <MoodSparkline
            trends={trends}
            streak={stats?.current_streak ?? 0}
            averageMood={stats?.average_mood ?? null}
          />
          <DailyReflection />
          <BadgesPanel badges={badges} />
        </div>
      </div>
    </div>
  );
}
