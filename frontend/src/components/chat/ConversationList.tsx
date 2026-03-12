"use client";

import type { Conversation } from "@/lib/types";
import { groupConversationsByDate } from "@/lib/utils";
import type { ConversationGroupKey } from "@/lib/utils";
import { useTranslations } from "next-intl";
import ConversationItem from "./ConversationItem";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const GROUP_KEYS: ConversationGroupKey[] = ["today", "yesterday", "previous7", "thisMonth", "older"];

type ConversationListProps = {
  conversations: Conversation[];
  activeId?: string | null;
  onDelete: (id: string) => void;
  isLoading: boolean;
  collapsed?: boolean;
};

export default function ConversationList({
  conversations,
  activeId,
  onDelete,
  isLoading,
  collapsed = false,
}: ConversationListProps) {
  const t = useTranslations("chat");

  if (isLoading) {
    return (
      <ul className="space-y-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg px-3 py-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            {!collapsed && <Skeleton className="h-4 flex-1 max-w-[80%] rounded" />}
          </li>
        ))}
      </ul>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">{t("noConversations")}</p>
    );
  }

  const grouped = groupConversationsByDate(conversations);

  return (
    <ul className="space-y-1">
      {GROUP_KEYS.map((key) => {
        const { conversations: list } = grouped[key];
        if (list.length === 0) return null;
        return (
          <li key={key}>
            {!collapsed && (
              <p
                className={cn(
                  "mb-1 mt-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:mt-0"
                )}
              >
                {t(key)}
              </p>
            )}
            {list.map((conv) => (
              <ConversationItem
                key={conv.conversation_id}
                conversation={conv}
                isActive={conv.conversation_id === activeId}
                onDelete={onDelete}
                collapsed={collapsed}
              />
            ))}
          </li>
        );
      })}
    </ul>
  );
}
