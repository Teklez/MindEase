"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  getStoredToken,
  getMe,
  getChatConversations,
  type ConversationResponse,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}

function getConversationsThisWeek(conversations: ConversationResponse[]): number {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return conversations.filter((c) => new Date(c.last_message_at) >= weekAgo).length;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tChat = useTranslations("chat");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const hour = typeof window !== "undefined" ? new Date().getHours() : 12;
  const welcomeKey = hour < 12 ? "welcomeMorning" : hour < 17 ? "welcomeAfternoon" : "welcomeEvening";
  const welcome = t(welcomeKey, { name: displayName ?? "" });

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([getMe(), getChatConversations()]).then(([meRes, convRes]) => {
      setLoading(false);
      if (!meRes.ok) {
        if (meRes.status === 401) return;
        router.replace("/login");
        return;
      }
      setDisplayName(meRes.data.display_name);
      if (convRes.ok) setConversations(convRes.data);
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-full bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-8 rounded-lg" />
          <div className="space-y-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (displayName === null) return null;

  const recent = conversations.slice(0, 3);
  const hasRecent = recent.length > 0;
  const thisWeek = getConversationsThisWeek(conversations);

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-xl text-foreground mb-8" id="dashboard-heading">
          {displayName ? welcome : tCommon("loading")}
        </p>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{t("totalConversations")}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{conversations.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{t("thisWeek")}</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{thisWeek}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">{t("streak")}</p>
            <p className="text-lg font-semibold text-muted-foreground mt-1">{tCommon("comingSoon")}</p>
          </div>
        </div>

        {/* Start New Chat */}
        <Link
          href="/chat"
          className="block rounded-2xl bg-card border border-border p-6 shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200 mb-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 shrink-0">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">{t("startChat")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("startChatDescLong")}
              </p>
            </div>
          </div>
        </Link>

        {/* Recent conversations */}
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-base font-semibold text-foreground mb-4">{t("recentChats")}</h2>
          {!hasRecent && (
            <p className="text-muted-foreground text-sm mb-4">{t("noChats")}</p>
          )}
          {hasRecent && (
            <ul className="space-y-3">
              {recent.map((c) => (
                <li key={c.conversation_id}>
                  <Link
                    href={"/chat/" + c.conversation_id}
                    className="block rounded-xl bg-card p-4 shadow-sm border border-border hover:border-primary/30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <h3 className="font-medium text-foreground truncate">{c.title || tChat("newChat")}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{formatRelativeTime(c.last_message_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/chat"
            className="inline-block mt-4 text-primary font-medium text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          >
            {hasRecent ? t("viewAllConversations") : t("goToChat")}
          </Link>
        </section>

        {/* Daily tip placeholder */}
        <section className="mt-10 rounded-xl border border-border bg-card/50 p-5 shadow-sm" aria-labelledby="daily-tip-heading">
          <h2 id="daily-tip-heading" className="text-sm font-semibold text-foreground mb-2">{t("dailyTip")}</h2>
          <p className="text-sm text-muted-foreground">{t("dailyTipComingSoon")}</p>
        </section>
      </div>
    </div>
  );
}
