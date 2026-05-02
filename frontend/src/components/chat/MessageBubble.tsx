"use client";

import type { ReactNode } from "react";
import type { Message } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatMessageTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

function renderSimpleMarkdown(text: string): ReactNode[] {
  const lines = text.split(/\n/);
  const out: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let key = 0;

  function renderInline(s: string): ReactNode[] {
    const parts: ReactNode[] = [];
    let remaining = s;
    let k = 0;
    while (remaining.length > 0) {
      const bold = remaining.match(/^\*\*(.+?)\*\*/);
      const italic = remaining.match(/^\*(.+?)\*/);
      if (bold) {
        parts.push(<strong key={k++}>{bold[1]}</strong>);
        remaining = remaining.slice(bold[0].length);
        continue;
      }
      if (italic) {
        parts.push(
          <em key={k++} className="font-serif">
            {italic[1]}
          </em>,
        );
        remaining = remaining.slice(italic[0].length);
        continue;
      }
      const next = remaining.search(/\*\*|\*/);
      if (next === -1) {
        parts.push(remaining);
        break;
      }
      parts.push(remaining.slice(0, next));
      remaining = remaining.slice(next);
    }
    return parts;
  }

  function flushList() {
    if (listItems.length > 0) {
      out.push(
        <ul key={key++} className="my-1 list-inside list-disc space-y-0.5">
          {listItems}
        </ul>,
      );
      listItems = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
    if (listMatch) {
      listItems.push(
        <li key={listItems.length} className="ml-2">
          {renderInline(listMatch[3])}
        </li>,
      );
    } else {
      flushList();
      if (line.trim() === "") {
        out.push(<br key={key++} />);
      } else {
        out.push(
          <p key={key++} className={out.length > 0 ? "mt-2" : ""}>
            {renderInline(line)}
          </p>,
        );
      }
    }
  }
  flushList();
  return out;
}

type MessageBubbleProps = {
  message: Message;
  isStreaming?: boolean;
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender_type === "user";

  if (isUser) {
    return (
      <div className="flex animate-fade-in justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground shadow-soft-sm">
          <div className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed">
            {message.content}
          </div>
          <p className="mt-1.5 text-right text-[10px] uppercase tracking-wider text-primary-foreground/70">
            {formatMessageTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in items-start gap-3">
      <Avatar className="mt-1 h-8 w-8 shrink-0 border border-border bg-card">
        <AvatarFallback className="bg-card text-[10px] font-semibold uppercase tracking-wider text-primary">
          ME
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl rounded-tl-md border border-border bg-muted/60 px-4 py-3",
          message.is_crisis_flagged && "border-l-2 border-l-destructive",
        )}
      >
        <div className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-foreground">
          <div className="space-y-0">{renderSimpleMarkdown(message.content)}</div>
        </div>
        <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
