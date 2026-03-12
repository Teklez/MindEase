"use client";

import React, { createContext, useContext } from "react";
import { useConversations } from "@/hooks/useConversations";

type ConversationsContextValue = ReturnType<typeof useConversations>;

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const value = useConversations();
  return (
    <ConversationsContext.Provider value={value}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversationsContext(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error("useConversationsContext must be used within ConversationsProvider");
  return ctx;
}

/** Optional hook for components that only need refresh (e.g. ChatContainer). */
export function useConversationsRefresh(): (() => Promise<void>) | null {
  const ctx = useContext(ConversationsContext);
  return ctx?.refresh ?? null;
}
