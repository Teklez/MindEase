"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown } from "lucide-react";
import type { Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageBubble from "./MessageBubble";
import StreamingMessage from "./StreamingMessage";
import TypingIndicator from "./TypingIndicator";
import { cn } from "@/lib/utils";

const SCROLL_THRESHOLD = 80;

type MessageListProps = {
  messages: Message[];
  streamingContent: string | null;
  isStreaming: boolean;
  isWaitingForResponse: boolean;
  crisisBanner?: React.ReactNode;
  className?: string;
};

export default function MessageList({
  messages,
  streamingContent,
  isStreaming,
  isWaitingForResponse,
  crisisBanner,
  className,
}: MessageListProps) {
  const t = useTranslations("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevContentLengthRef = useRef(0);

  const checkNearBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    return scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleScroll = () => setIsNearBottom(checkNearBottom());
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [checkNearBottom]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const viewport = (root.querySelector("[data-radix-scroll-area-viewport]") ??
      root.firstElementChild) as HTMLDivElement | null;
    if (viewport) viewportRef.current = viewport;
    return () => {
      viewportRef.current = null;
    };
  }, []);

  useEffect(() => {
    const contentLength = messages.length + (streamingContent?.length ?? 0);
    const hadUpdate = contentLength !== prevContentLengthRef.current;
    prevContentLengthRef.current = contentLength;
    if (hadUpdate && isNearBottom) scrollToBottom("smooth");
  }, [messages.length, streamingContent, isNearBottom, scrollToBottom]);

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
        <div
          className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 md:px-6"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {crisisBanner}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.message_id || `${msg.timestamp}-${msg.content.slice(0, 20)}`}
              message={msg}
            />
          ))}
          {isWaitingForResponse && !isStreaming && <TypingIndicator />}
          {isStreaming && streamingContent !== null && (
            <StreamingMessage tokens={streamingContent} isComplete={false} />
          )}
          <div ref={bottomRef} className="h-px" aria-hidden />
        </div>
      </ScrollArea>
      {!isNearBottom && (
        <button
          type="button"
          onClick={() => {
            scrollToBottom("smooth");
            setIsNearBottom(true);
          }}
          className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-soft-md transition-all hover:-translate-y-px hover:shadow-soft-lg"
        >
          <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
          {t("scrollToBottom")}
        </button>
      )}
    </div>
  );
}
