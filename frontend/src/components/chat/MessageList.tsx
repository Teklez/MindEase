"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown } from "lucide-react";
import type { Message } from "@/lib/types";
import { isToday, isYesterday } from "@/lib/relative-time";
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
  userInitials?: string;
  className?: string;
};

type DayGroup = { dayKey: string; label: string; messages: Message[] };

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(messages: Message[], locale: string): DayGroup[] {
  const out: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const m of messages) {
    const d = new Date(m.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKeyOf(d);
    if (!current || current.dayKey !== key) {
      const label = isToday(d)
        ? "Today"
        : isYesterday(d)
          ? "Yesterday"
          : new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(d);
      current = { dayKey: key, label, messages: [] };
      out.push(current);
    }
    current.messages.push(m);
  }
  return out;
}

export default function MessageList({
  messages,
  streamingContent,
  isStreaming,
  isWaitingForResponse,
  crisisBanner,
  userInitials,
  className,
}: MessageListProps) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevContentLengthRef = useRef(0);

  const groups = useMemo(() => groupByDay(messages, locale), [messages, locale]);

  const checkNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => setIsNearBottom(checkNearBottom());
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [checkNearBottom]);

  useEffect(() => {
    const contentLength = messages.length + (streamingContent?.length ?? 0);
    const hadUpdate = contentLength !== prevContentLengthRef.current;
    prevContentLengthRef.current = contentLength;
    if (hadUpdate && isNearBottom) scrollToBottom("smooth");
  }, [messages.length, streamingContent, isNearBottom, scrollToBottom]);

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-background to-secondary/40"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        <div className="mx-auto w-full max-w-[760px] space-y-6 px-4 py-6 md:px-6">
          {crisisBanner}
          {groups.map((g) => (
            <Fragment key={g.dayKey}>
              <div className="flex items-center gap-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span>{g.label}</span>
                <span className="h-px flex-1 bg-border" aria-hidden />
              </div>
              <div className="space-y-5">
                {g.messages.map((msg) => (
                  <MessageBubble
                    key={msg.message_id || `${msg.timestamp}-${msg.content.slice(0, 20)}`}
                    message={msg}
                    userInitials={userInitials}
                  />
                ))}
              </div>
            </Fragment>
          ))}
          {isWaitingForResponse && !isStreaming && <TypingIndicator />}
          {isStreaming && streamingContent !== null && (
            <StreamingMessage tokens={streamingContent} isComplete={false} />
          )}
          <div ref={bottomRef} className="h-px" aria-hidden />
        </div>
      </div>
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
