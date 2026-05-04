"use client";

import type { Conversation } from "@/lib/types";
import { groupConversationsByDate, type ConversationGroupKey } from "@/lib/utils";
import { useTranslations } from "next-intl";
import ConversationItem from "./ConversationItem";
import { Skeleton } from "@/components/ui/skeleton";

const GROUP_KEYS: ConversationGroupKey[] = [
  "today",
  "yesterday",
  "previous7",
  "thisMonth",
  "older",
];

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
      <ul className="space-y-1.5 p-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg px-3 py-2">
            <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
            {!collapsed && <Skeleton className="h-3 flex-1 max-w-[80%] rounded" />}
          </li>
        ))}
      </ul>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t("noConversations")}
      </p>
    );
  }

  const grouped = groupConversationsByDate(conversations);

  return (
    <ul className="flex flex-col gap-3 px-1 pt-1">
      {GROUP_KEYS.map((key) => {
        const list = grouped[key].conversations;
        if (list.length === 0) return null;
        return (
          <li key={key}>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t(key)}
              </p>
            )}
            <ul className="space-y-0.5">
              {list.map((conv) => (
                <ConversationItem
                  key={conv.conversation_id}
                  conversation={conv}
                  isActive={conv.conversation_id === activeId}
                  onDelete={onDelete}
                  collapsed={collapsed}
                />
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
