"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";

type Props = {
  conversations: Conversation[];
};

export default function RecentConversations({ conversations }: Props) {
  const t = useTranslations("dashboard");
  const tChat = useTranslations("chat");
  const recent = conversations.slice(0, 3);

  return (
    <section aria-labelledby="recent-heading" className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm">
      <header className="flex items-end justify-between">
        <div>
          <h2 id="recent-heading" className="font-serif text-xl tracking-tight text-foreground">
            {t("recentChats")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("recentSubtitle")}</p>
        </div>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t("viewAll")} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      </header>

      {recent.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
          <MessageCircle className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-muted-foreground">{t("noChats")}</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-3">
          {recent.map((c) => (
            <li key={c.conversation_id}>
              <Link
                href={`/chat/${c.conversation_id}`}
                className="group flex h-full flex-col rounded-xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
              >
                <h3 className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                  {c.title || tChat("newChat")}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {c.total_messages > 0
                    ? `${c.total_messages} message${c.total_messages === 1 ? "" : "s"}`
                    : tChat("startFirst")}
                </p>
                <p className="mt-auto pt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {relativeTime(c.last_message_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
