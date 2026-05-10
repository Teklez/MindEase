"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getChatConversations,
  getMe,
  getMoodHistory,
  getStoredToken,
  type BadgeResponse,
  type MoodEntryResponse,
} from "@/lib/api";
import type { Conversation, MoodTrend, MoodStats } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import GreetingHero from "@/components/dashboard/GreetingHero";
import StatCards from "@/components/dashboard/StatCards";
import ReflectionCard from "@/components/dashboard/ReflectionCard";
import ResourceCard from "@/components/dashboard/ResourceCard";
import RecentConversations from "@/components/dashboard/RecentConversations";
import YourGroups from "@/components/dashboard/YourGroups";
import FooterBand from "@/components/dashboard/FooterBand";
import DashboardMoodWidget from "@/components/mood/DashboardMoodWidget";
import MoodCheckIn from "@/components/mood/MoodCheckIn";

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function sessionsThisWeek(conversations: Conversation[]): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return conversations.filter((c) => new Date(c.last_message_at).getTime() >= weekAgo).length;
}

function sessionsSparkline(conversations: Conversation[]): Array<{ value: number }> {
  const today = new Date();
  const buckets: number[] = Array.from({ length: 7 }, () => 0);
  for (const c of conversations) {
    const d = new Date(c.last_message_at);
    const diff = Math.floor((today.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diff >= 0 && diff < 7) buckets[6 - diff]++;
  }
  return buckets.map((value) => ({ value }));
}

export default function DashboardPage() {
  const router = useRouter();
  const tMood = useTranslations("mood");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [trends, setTrends] = useState<MoodTrend[]>([]);
  const [stats, setStats] = useState<MoodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const refreshMoodRef = useRef(0);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    Promise.all([getMe(), getChatConversations(), getMoodHistory(30)]).then(
      ([meRes, convRes, moodRes]) => {
        if (cancelled) return;
        setLoading(false);
        if (!meRes.ok) {
          if (meRes.status === 401) return;
          router.replace("/login");
          return;
        }
        setDisplayName(meRes.data.display_name);
        if (convRes.ok) setConversations(convRes.data as Conversation[]);
        if (moodRes.ok) {
          setTrends(moodRes.data.daily_trends);
          setStats(moodRes.data.stats);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router, refreshMoodRef.current]);

  const lastCheckIn = useMemo(() => {
    const sorted = [...trends].filter((t) => t.entry_count > 0).sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.date;
  }, [trends]);

  const moodDelta = useMemo(() => {
    if (!stats?.average_mood) return null;
    const last7 = trends.slice(-7).filter((t) => t.entry_count > 0);
    const prev7 = trends.slice(-14, -7).filter((t) => t.entry_count > 0);
    if (last7.length === 0 || prev7.length === 0) return null;
    const avg = (arr: MoodTrend[]) => arr.reduce((s, t) => s + t.average_mood, 0) / arr.length;
    return avg(last7) - avg(prev7);
  }, [trends, stats]);

  const handleMoodCreated = (_entry: MoodEntryResponse, newBadges: BadgeResponse[]) => {
    refreshMoodRef.current++;
    setCheckInOpen(false);
    toast({
      title: tMood("logged"),
      description:
        newBadges.length > 0
          ? `${tMood("badgeEarned")} ${newBadges.map((b) => b.icon + " " + b.name).join(", ")}`
          : undefined,
    });
    getMoodHistory(30).then((res) => {
      if (res.ok) {
        setTrends(res.data.daily_trends);
        setStats(res.data.stats);
      }
    });
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <div className="space-y-6">
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-44 rounded-2xl lg:col-span-8" />
            <Skeleton className="h-44 rounded-2xl lg:col-span-4" />
          </div>
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (displayName === null) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <div className="space-y-6">
        <GreetingHero
          displayName={displayName}
          daysSinceCheckIn={daysSince(lastCheckIn)}
          onQuickCheckIn={() => setCheckInOpen(true)}
        />

        <StatCards
          currentStreak={stats?.current_streak ?? 0}
          longestStreak={stats?.longest_streak ?? 0}
          averageMood={stats?.average_mood ?? null}
          moodDelta={moodDelta}
          sessionsThisWeek={sessionsThisWeek(conversations)}
          sparkline={sessionsSparkline(conversations)}
        />

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <DashboardMoodWidget
              trends={trends}
              streak={stats?.current_streak ?? 0}
              onPillClick={() => setCheckInOpen(true)}
            />
          </div>
          <div className="space-y-6 lg:col-span-4">
            <ReflectionCard />
            <ResourceCard />
          </div>
        </div>

        <RecentConversations conversations={conversations} />

        <YourGroups />

        <FooterBand />
      </div>

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl tracking-tight">{tMood("checkIn")}</DialogTitle>
          </DialogHeader>
          <MoodCheckIn onEntryCreated={handleMoodCreated} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
