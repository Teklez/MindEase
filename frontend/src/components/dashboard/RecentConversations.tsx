"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Conversation } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";

type Props = {
  conversations: Conversation[];
};

export default function RecentConversations({ conversations }: Props) {
  const t = useTranslations("dashboard.v2.recent");
  const tChat = useTranslations("chat");
  const recent = conversations.slice(0, 3);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="font-serif text-[20px] font-[360] tracking-[-0.01em] text-foreground">
          {t("title")}
        </h2>
        <Link
          href="/chat"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary transition-colors hover:text-foreground"
        >
          {t("viewAll")}
        </Link>
      </header>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-[14px] text-muted-foreground">{t("empty")}</p>
          <Link
            href="/chat"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary transition-colors hover:text-foreground"
          >
            {t("emptyCta")} →
          </Link>
        </div>
      ) : (
        <ul>
          {recent.map((c, i) => {
            const messages = c.total_messages;
            const messageLine =
              messages > 0
                ? `${messages} message${messages === 1 ? "" : "s"}`
                : tChat("startFirst");
            return (
              <li key={c.conversation_id} className="border-b border-border last:border-b-0">
                <Link
                  href={`/chat/${c.conversation_id}`}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-5 transition-colors hover:bg-accent"
                >
                  <span className="font-mono text-[11px] tracking-[0.1em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-medium text-foreground">
                      {c.title?.trim() || tChat("newChat")}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {messageLine}
                    </div>
                  </div>
                  <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {relativeTime(c.last_message_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
