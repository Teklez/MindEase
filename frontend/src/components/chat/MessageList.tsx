"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= SCROLL_THRESHOLD;
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

  // Attach ref to ScrollArea viewport (first child of root is the viewport)
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const viewport = (root.querySelector("[data-radix-scroll-area-viewport]") ?? root.firstElementChild) as HTMLDivElement | null;
    if (viewport) viewportRef.current = viewport;
    return () => {
      viewportRef.current = null;
    };
  }, []);

  // Auto-scroll when new messages or streaming content grows, only if user was near bottom
  useEffect(() => {
    const contentLength = messages.length + (streamingContent?.length ?? 0);
    const hadUpdate = contentLength !== prevContentLengthRef.current;
    prevContentLengthRef.current = contentLength;

    if (hadUpdate && isNearBottom) {
      scrollToBottom("smooth");
    }
  }, [messages.length, streamingContent, isNearBottom, scrollToBottom]);

  return (
    <div className={cn("relative flex flex-col flex-1 min-h-0", className)}>
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="mx-auto w-full max-w-4xl px-4 py-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
          {crisisBanner}
          {messages.map((msg) => (
            <MessageBubble key={msg.message_id || `${msg.timestamp}-${msg.content.slice(0, 20)}`} message={msg} />
          ))}
          {isWaitingForResponse && !isStreaming && <TypingIndicator />}
          {isStreaming && streamingContent !== null && (
            <StreamingMessage tokens={streamingContent} isComplete={false} />
          )}
          <div ref={bottomRef} className="h-px" aria-hidden />
        </div>
      </ScrollArea>
      {!isNearBottom && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            className="shadow-md"
            onClick={() => {
              scrollToBottom("smooth");
              setIsNearBottom(true);
            }}
          >
            {t("scrollToBottom")}
          </Button>
        </div>
      )}
    </div>
  );
}
