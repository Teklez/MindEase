"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGroupMessages,
  getStoredToken,
  markGroupRead,
} from "@/lib/api";
import {
  GroupChatWebSocket,
  type GroupOnlineMember,
  type GroupWsEvent,
} from "@/lib/websocket";
import type { CrisisResources, GroupMessageResponse } from "@/lib/types";

export type GroupConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

interface UseGroupChat {
  messages: GroupMessageResponse[];
  isLoading: boolean;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  connectionStatus: GroupConnectionStatus;
  onlineMembers: GroupOnlineMember[];
  crisisResources: CrisisResources | null;
  aiThinking: boolean;
  dismissCrisis: () => void;
  sendMessage: (content: string) => void;
  loadMoreMessages: () => Promise<void>;
}

const PAGE_SIZE = 50;

export function useGroupChat(
  groupId: string,
  options: { enabled?: boolean } = {},
): UseGroupChat {
  const enabled = options.enabled !== false;

  const [messages, setMessages] = useState<GroupMessageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<GroupConnectionStatus>("connecting");
  const [onlineMembers, setOnlineMembers] = useState<GroupOnlineMember[]>([]);
  const [crisisResources, setCrisisResources] =
    useState<CrisisResources | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const wsRef = useRef<GroupChatWebSocket | null>(null);
  // Track message ids we've already inserted so duplicate broadcasts (e.g. echoed
  // sender messages) don't double-render.
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Throttle mark-read calls so a flurry of incoming messages doesn't hammer
  // the endpoint. Bumps last_read_at at most every MARK_READ_THROTTLE_MS.
  const lastMarkReadRef = useRef<number>(0);
  const MARK_READ_THROTTLE_MS = 2000;

  const maybeMarkRead = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastMarkReadRef.current < MARK_READ_THROTTLE_MS) return;
    lastMarkReadRef.current = now;
    void markGroupRead(groupId);
  }, [groupId]);

  const appendMessage = useCallback((msg: GroupMessageResponse) => {
    if (seenIdsRef.current.has(msg.message_id)) return;
    seenIdsRef.current.add(msg.message_id);
    setMessages((prev) => [...prev, msg]);
  }, []);

  // ---- Initial REST load ----
  useEffect(() => {
    if (!enabled || !groupId) return;
    let cancelled = false;
    setIsLoading(true);
    seenIdsRef.current = new Set();
    setMessages([]);
    setHasMoreMessages(false);

    getGroupMessages(groupId, { limit: PAGE_SIZE }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const list = res.data;
        seenIdsRef.current = new Set(list.map((m) => m.message_id));
        setMessages(list);
        setHasMoreMessages(list.length >= PAGE_SIZE);
        // Caught up — clear the unread badge for this group.
        void markGroupRead(groupId);
        lastMarkReadRef.current = Date.now();
      }
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, groupId]);

  // ---- WebSocket lifecycle ----
  useEffect(() => {
    if (!enabled || !groupId) return;
    const token = getStoredToken();
    if (!token) {
      setConnectionStatus("error");
      return;
    }

    const ws = new GroupChatWebSocket(groupId, token);
    wsRef.current = ws;

    const handleEvent = (event: GroupWsEvent) => {
      switch (event.type) {
        case "message": {
          appendMessage(event.data);
          // Tab is open and looking at this group — clear unread.
          maybeMarkRead();
          break;
        }
        case "crisis_alert": {
          const r = event.resources ?? {};
          setCrisisResources({
            ethiopia: (r.ethiopia ?? []).map((x) => ({
              name: x.name,
              phone: x.phone ?? "",
            })),
            international: (r.international ?? []).map((x) => ({
              name: x.name,
              ...(x.info != null && { info: x.info }),
              ...(x.url != null && { url: x.url }),
            })),
          });
          break;
        }
        case "user_joined": {
          // Presence-only — the persisted "Alice joined the group" system
          // message arrives separately as a `message` event from the REST
          // join handler. Just update the online roster.
          setOnlineMembers((prev) =>
            prev.some((m) => m.user_id === event.user_id)
              ? prev
              : [
                  ...prev,
                  { user_id: event.user_id, display_name: event.display_name },
                ],
          );
          break;
        }
        case "user_left": {
          setOnlineMembers((prev) =>
            prev.filter((m) => m.user_id !== event.user_id),
          );
          break;
        }
        case "online_members": {
          setOnlineMembers(event.members);
          break;
        }
        case "ai_thinking": {
          setAiThinking(true);
          break;
        }
        case "ai_done": {
          setAiThinking(false);
          break;
        }
        case "error": {
          // Surfacing as a system message keeps the user informed without
          // hijacking the toast system.
          const synthetic: GroupMessageResponse = {
            message_id: `system-error-${Date.now()}`,
            group_id: groupId,
            user_id: null,
            sender_type: "system",
            sender_name: null,
            content: event.content ?? "Something went wrong",
            is_crisis_flagged: false,
            timestamp: new Date().toISOString(),
          };
          appendMessage(synthetic);
          break;
        }
      }
    };

    ws.connect({
      onEvent: handleEvent,
      onConnectionState: (state) => {
        if (state === "connecting" || state === "reconnecting") {
          setConnectionStatus("connecting");
        } else if (state === "connected") {
          setConnectionStatus("connected");
          // Ask the server who's online once we're up.
          ws.requestOnlineMembers();
        } else if (state === "failed") {
          setConnectionStatus("error");
        }
      },
    });

    return () => {
      ws.disconnect();
      wsRef.current = null;
      setConnectionStatus("disconnected");
    };
  }, [enabled, groupId, appendMessage, maybeMarkRead]);

  const sendMessage = useCallback((content: string) => {
    wsRef.current?.sendMessage(content);
  }, []);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || isLoadingMore || messages.length === 0) return;
    setIsLoadingMore(true);
    const oldest = messages[0];
    const res = await getGroupMessages(groupId, {
      limit: PAGE_SIZE,
      before: oldest.timestamp,
    });
    if (res.ok) {
      const older = res.data.filter(
        (m) => !seenIdsRef.current.has(m.message_id),
      );
      for (const m of older) seenIdsRef.current.add(m.message_id);
      setMessages((prev) => [...older, ...prev]);
      setHasMoreMessages(res.data.length >= PAGE_SIZE);
    }
    setIsLoadingMore(false);
  }, [groupId, messages, hasMoreMessages, isLoadingMore]);

  const dismissCrisis = useCallback(() => setCrisisResources(null), []);

  return {
    messages,
    isLoading,
    hasMoreMessages,
    isLoadingMore,
    connectionStatus,
    onlineMembers,
    crisisResources,
    aiThinking,
    dismissCrisis,
    sendMessage,
    loadMoreMessages,
  };
}
