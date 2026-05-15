"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeft, Phone } from "lucide-react";
import type { CrisisResources, Message } from "@/lib/types";
import { getConversation } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useConversationsRefresh } from "@/contexts/ConversationsContext";
import { toast } from "@/hooks/use-toast";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import StarterPrompts from "./StarterPrompts";
import CrisisBanner from "./CrisisBanner";
import { Skeleton } from "@/components/ui/skeleton";

const INITIAL_MESSAGE_KEY = "mindease-initial-message";

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
  const [conversationType, setConversationType] = useState<"text" | "voice">("text");
  const [personaName, setPersonaName] = useState<string | null>(null);
  const refreshConversations = useConversationsRefresh();

  const handleWebSocketEvent = useCallback(
    (event: Parameters<Parameters<typeof useWebSocket>[1]>[0]) => {
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
          ethiopia: (Array.isArray(r.ethiopia) ? r.ethiopia : []).map((x) => ({
            name: x.name,
            phone: x.phone ?? "",
          })),
          international: (Array.isArray(r.international) ? r.international : []).map((x) => ({
            name: x.name,
            ...(x.info != null && { info: x.info }),
            ...(x.url != null && { url: x.url }),
          })),
        });
      } else if (event.type === "error") {
        toast({ title: tChat("messageFailed"), variant: "destructive" });
        const errorMessage: Message = {
          message_id: crypto.randomUUID(),
          conversation_id: "",
          sender_type: "ai",
          content: event.content ?? "Something went wrong.",
          detected_emotion: null,
          timestamp: new Date().toISOString(),
          is_crisis_flagged: false,
        };
        setMessages((m) => [...m, errorMessage]);
        setIsStreaming(false);
        setIsWaitingForResponse(false);
      }
    },
    [refreshConversations, conversationId, tChat],
  );

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
        setConversationType(res.data.conversation_type ?? "text");
        setPersonaName(res.data.attrs?.persona_name ?? null);
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
    [conversationId, send, locale],
  );

  const header = (
    <>
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
        <Link
          href="/chat"
          className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={tChat("backToChatList")}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-serif text-lg tracking-tight text-foreground">
          {title}
        </h1>
        {connectionStatus === "connected" && (
          <span className="hidden items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> live
          </span>
        )}
      </div>
      {connectionStatus === "connecting" && conversationType !== "voice" && (
        <p className="shrink-0 bg-muted py-1.5 text-center text-xs text-muted-foreground">
          {tChat("connecting")}
        </p>
      )}
      {connectionStatus === "error" && conversationType !== "voice" && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 py-2 px-4 text-center text-sm text-destructive">
          {tChat("connectionProblem")}
        </div>
      )}
      {conversationType === "voice" && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Voice conversation · {personaName ?? "Avatar"}
          </p>
          <Link
            href={`/avatar?conversation=${conversationId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/60 bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/15"
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
            Continue this call
          </Link>
        </div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={i % 2 === 0 ? "flex justify-end" : "flex gap-3"}>
                <Skeleton
                  className={
                    i % 2 === 0
                      ? "h-14 w-3/4 max-w-md rounded-2xl"
                      : "h-16 w-2/3 max-w-md rounded-2xl"
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 px-4 py-3">
          <Skeleton className="mx-auto h-14 w-full max-w-3xl rounded-2xl" />
        </div>
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col">
        {header}
        {conversationType !== "voice" && <StarterPrompts onSelect={handleSend} />}
        {conversationType !== "voice" && (
          <ChatInput onSend={handleSend} disabled={isStreaming || isWaitingForResponse} />
        )}
      </div>
    );
  }

  const crisisBannerNode = crisisResources ? (
    <CrisisBanner resources={crisisResources} onDismiss={() => setCrisisResources(null)} />
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        isWaitingForResponse={isWaitingForResponse}
        crisisBanner={crisisBannerNode}
      />
      {conversationType !== "voice" && (
        <ChatInput onSend={handleSend} disabled={isStreaming || isWaitingForResponse} />
      )}
    </div>
  );
}
