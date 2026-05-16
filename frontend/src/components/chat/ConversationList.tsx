"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Conversation } from "@/lib/types";
import { groupConversations, type ConversationGroups } from "@/lib/group-conversations";
import ConversationItem from "./ConversationItem";
import { Skeleton } from "@/components/ui/skeleton";

type ConversationListProps = {
  conversations: Conversation[];
  activeId?: string | null;
  onDelete: (id: string) => void;
  onRename?: (conv: Conversation) => void;
  isLoading: boolean;
};

const GROUP_ORDER = ["today", "yesterday", "thisWeek", "earlier"] as const;
const GROUP_LABEL_KEY: Record<(typeof GROUP_ORDER)[number], string> = {
  today: "today",
  yesterday: "yesterday",
  thisWeek: "last7",
  earlier: "earlier",
};

export default function ConversationList({
  conversations,
  activeId,
  onDelete,
  onRename,
  isLoading,
}: ConversationListProps) {
  const t = useTranslations("chat.v2.groups");
  const tChat = useTranslations("chat");

  const groups = useMemo(() => {
    // Adapt Conversation → Groupable. The grouper's type bound has
    // `title: string | undefined` while Conversation has `string | null`, so
    // we go through `unknown` to satisfy both shapes while keeping the
    // grouped output typed as Conversation[].
    const adapted = conversations.map((c) => ({
      ...c,
      id: c.conversation_id,
      updated_at: c.last_message_at,
      title: c.title ?? undefined,
    }));
    return groupConversations(adapted) as unknown as ConversationGroups<Conversation>;
  }, [conversations]);

  if (isLoading) {
    return (
      <ul className="space-y-2 px-2 py-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i} className="rounded-xl px-3 py-2.5">
            <Skeleton className="h-3.5 w-4/5 rounded" />
            <Skeleton className="mt-1.5 h-3 w-1/2 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
        {tChat("noConversations")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4 px-2 pt-1">
      {GROUP_ORDER.map((key) => {
        const list = groups[key];
        if (list.length === 0) return null;
        return (
          <li key={key}>
            <p className="mb-1 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t(GROUP_LABEL_KEY[key])}
            </p>
            <ul className="flex flex-col gap-1.5">
              {list.map((conv) => (
                <ConversationItem
                  key={conv.conversation_id}
                  conversation={conv}
                  isActive={conv.conversation_id === activeId}
                  onDelete={onDelete}
                  onRename={onRename}
                />
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
