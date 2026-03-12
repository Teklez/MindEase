"use client";

import type { ReactNode } from "react";
import type { Message } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatMessageTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** Simple markdown: **bold**, *italic*, newlines, - or * bullet lists */
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
        parts.push(<em key={k++}>{italic[1]}</em>);
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
        <ul key={key++} className="list-disc list-inside my-1 space-y-0.5">
          {listItems}
        </ul>
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
        </li>
      );
    } else {
      flushList();
      if (line.trim() === "") {
        out.push(<br key={key++} />);
      } else {
        out.push(
          <p key={key++} className={out.length > 0 ? "mt-2" : ""}>
            {renderInline(line)}
          </p>
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

  const bubble = (
    <div
      className={cn(
        "max-w-[75%] rounded-2xl px-4 py-3 animate-fade-in",
        isUser
          ? "ml-auto rounded-br-md bg-primary text-primary-foreground"
          : "rounded-bl-md border border-border bg-card shadow-sm",
        !isUser && message.is_crisis_flagged && "border-l-4 border-l-destructive"
      )}
    >
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
        {isUser ? (
          message.content
        ) : (
          <div className="space-y-0">{renderSimpleMarkdown(message.content)}</div>
        )}
      </div>
      <p
        className={cn(
          "mt-1.5 text-xs",
          isUser ? "text-primary-foreground/80 text-right" : "text-muted-foreground text-left"
        )}
      >
        {formatMessageTime(message.timestamp)}
      </p>
    </div>
  );

  if (isUser) {
    return <div className="flex justify-end">{bubble}</div>;
  }

  return (
    <div className="flex gap-2 justify-start">
      <Avatar className="h-8 w-8 shrink-0 border border-border bg-primary/10">
        <AvatarFallback className="text-primary text-xs font-medium">ME</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">{bubble}</div>
    </div>
  );
}
