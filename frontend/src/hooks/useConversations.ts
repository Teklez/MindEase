"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getChatConversations,
  createConversation as createConversationApi,
  deleteConversation as deleteConversationApi,
  type ApiResponse,
} from "@/lib/api";
import type { Conversation } from "@/lib/types";

export function useConversations(): {
  conversations: Conversation[];
  isLoading: boolean;
  createConversation: () => Promise<Conversation | null>;
  deleteConversation: (id: string) => Promise<ApiResponse<null>>;
  refresh: () => Promise<void>;
} {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await getChatConversations();
    setLoading(false);
    if (res.ok) setConversations(res.data as Conversation[]);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createConversation = useCallback(async (): Promise<Conversation | null> => {
    const res = await createConversationApi(null);
    if (res.ok) {
      setConversations((prev) => [res.data as Conversation, ...prev]);
      return res.data as Conversation;
    }
    return null;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    const res = await deleteConversationApi(id);
    if (res.ok) setConversations((prev) => prev.filter((c) => c.conversation_id !== id));
    return res;
  }, []);

  return {
    conversations,
    isLoading: loading,
    createConversation,
    refresh,
    deleteConversation,
  };
}
