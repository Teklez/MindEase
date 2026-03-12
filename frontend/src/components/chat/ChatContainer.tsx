"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
const INITIAL_MESSAGE_KEY = "mindease-initial-message";
import Link from "next/link";
import type { Message } from "@/lib/types";
import type { CrisisResources } from "@/lib/types";
import { getConversation } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConversationsRefresh } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import StarterPrompts from "./StarterPrompts";
import CrisisBanner from "./CrisisBanner";
import { Skeleton } from "@/components/ui/skeleton";

type ChatContainerProps = {
  conversationId: string;
};

export default function ChatContainer({ conversationId }: ChatContainerProps) {
  const tChat = useTranslations("chat");
  const locale = useLocale() as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const streamingContentRef = useRef<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [crisisResources, setCrisisResources] = useState<CrisisResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Chat");
  const refreshConversations = useConversationsRefresh();

  const handleWebSocketEvent = useCallback((event: Parameters<Parameters<typeof useWebSocket>[1]>[0]) => {
    if (event.type === "token") {
      setIsWaitingForResponse(false);
      setIsStreaming(true);
      streamingContentRef.current = (streamingContentRef.current ?? "") + (event.content ?? "");
      setStreamingContent(streamingContentRef.current);
    } else if (event.type === "done") {
      const text = streamingContentRef.current ?? "";
      streamingContentRef.current = null;
      setStreamingContent(null);
      setIsStreaming(false);
      if (text.length > 0) {
        const aiMessage: Message = {
          message_id: event.message_id ?? crypto.randomUUID(),
          conversation_id: "",
          sender_type: "ai",
          content: text,
          detected_emotion: null,
          timestamp: new Date().toISOString(),
          is_crisis_flagged: false,
        };
        setMessages((m) => [...m, aiMessage]);
      }
      refreshConversations?.();
      getConversation(conversationId).then((res) => {
        if (res.ok && res.data.title) setTitle(res.data.title);
      });
    } else if (event.type === "crisis_alert") {
      const r = event.resources;
      if (!r) {
        setCrisisResources(null);
        return;
      }
      setCrisisResources({
        ethiopia: (Array.isArray(r.ethiopia) ? r.ethiopia : []).map((x) => ({ name: x.name, phone: x.phone ?? "" })),
        international: (Array.isArray(r.international) ? r.international : []).map((x) => ({
          name: x.name,
          ...(x.info != null && { info: x.info }),
          ...(x.url != null && { url: x.url }),
        })),
      });
    } else if (event.type === "error") {
      toast({ title: tChat("messageFailed"), variant: "destructive" });
      const errorContent = event.content ?? "Something went wrong.";
      const errorMessage: Message = {
        message_id: crypto.randomUUID(),
        conversation_id: "",
        sender_type: "ai",
        content: errorContent,
        detected_emotion: null,
        timestamp: new Date().toISOString(),
        is_crisis_flagged: false,
      };
      setMessages((m) => [...m, errorMessage]);
      setIsStreaming(false);
      setIsWaitingForResponse(false);
    }
  }, [refreshConversations, conversationId, tChat]);

  const { send, connectionStatus } = useWebSocket(conversationId, handleWebSocketEvent);
  const sentInitialRef = useRef(false);
  const prevConnectionStatusRef = useRef<typeof connectionStatus>(connectionStatus);

  useEffect(() => {
    if (prevConnectionStatusRef.current === "connected" && connectionStatus === "error") {
      toast({ title: tChat("connectionLost"), variant: "destructive" });
    } else if (prevConnectionStatusRef.current === "error" && connectionStatus === "connected") {
      toast({ title: tChat("reconnected") });
    }
    prevConnectionStatusRef.current = connectionStatus;
  }, [connectionStatus, tChat]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConversation(conversationId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setMessages(res.data.messages as Message[]);
        setTitle(res.data.title || tChat("newChat"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, tChat]);

  useEffect(() => {
    sentInitialRef.current = false;
    streamingContentRef.current = null;
  }, [conversationId]);

  // Send initial message from chat home (e.g. starter prompt) once when ready
  useEffect(() => {
    if (loading || connectionStatus !== "connected" || sentInitialRef.current) return;
    try {
      const initial = sessionStorage.getItem(INITIAL_MESSAGE_KEY);
      if (initial) {
        sessionStorage.removeItem(INITIAL_MESSAGE_KEY);
        sentInitialRef.current = true;
        const trimmed = initial.trim();
        if (trimmed) {
          const userMessage: Message = {
            message_id: crypto.randomUUID(),
            conversation_id: conversationId,
            sender_type: "user",
            content: trimmed,
            detected_emotion: null,
            timestamp: new Date().toISOString(),
            is_crisis_flagged: false,
          };
          setMessages((prev) => [...prev, userMessage]);
          setStreamingContent(null);
          setIsWaitingForResponse(true);
          send(trimmed, locale === "am" || locale === "en" ? locale : undefined);
        }
      }
    } catch {
      /* ignore */
    }
  }, [loading, connectionStatus, conversationId, send, locale]);

  const handleSend = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMessage: Message = {
        message_id: crypto.randomUUID(),
        conversation_id: conversationId,
        sender_type: "user",
        content: trimmed,
        detected_emotion: null,
        timestamp: new Date().toISOString(),
        is_crisis_flagged: false,
      };
      setMessages((prev) => [...prev, userMessage]);
      setStreamingContent(null);
      setIsWaitingForResponse(true);
      send(trimmed, locale === "am" || locale === "en" ? locale : undefined);
    },
    [conversationId, send, locale]
  );

  const header = (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 py-3">
        <Link
          href="/chat"
          className="rounded-lg p-2 -m-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={tChat("backToChatList")}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{title}</h1>
      </div>
      {connectionStatus === "connecting" && (
        <p className="shrink-0 bg-muted/50 py-1.5 text-center text-xs text-muted-foreground">{tChat("connecting")}</p>
      )}
      {connectionStatus === "error" && (
        <div className="shrink-0 border-b border-border bg-muted py-2 px-4 text-center text-sm text-foreground">
          {tChat("connectionProblem")}
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={i % 2 === 0 ? "flex justify-end" : "flex gap-2 justify-start"}>
                <Skeleton className={i % 2 === 0 ? "h-14 w-3/4 max-w-md rounded-2xl" : "h-16 w-2/3 max-w-md rounded-2xl"} />
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 px-4 py-3">
          <Skeleton className="mx-auto h-14 w-full max-w-4xl rounded-2xl" />
        </div>
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <StarterPrompts onSelect={handleSend} />
        <ChatInput onSend={handleSend} disabled={isStreaming || isWaitingForResponse} />
      </div>
    );
  }

  const crisisBannerNode =
    crisisResources != null ? (
      <CrisisBanner resources={crisisResources} onDismiss={() => setCrisisResources(null)} />
    ) : null;

  return (
    <div className="flex h-full flex-col min-h-0">
      {header}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        isWaitingForResponse={isWaitingForResponse}
        crisisBanner={crisisBannerNode}
      />
      <ChatInput onSend={handleSend} disabled={isStreaming || isWaitingForResponse} />
    </div>
  );
}
