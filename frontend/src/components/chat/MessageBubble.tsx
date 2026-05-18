"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Message } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { cn, formatMessageTime, safeClipboardWrite } from "@/lib/utils";

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

function renderSimpleMarkdown(text: string): ReactNode[] {
  const lines = text.split(/\n/);
  const out: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let key = 0;

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

function initialsOf(name?: string): string {
  if (!name) return "M";
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type MessageBubbleProps = {
  message: Message;
  isStreaming?: boolean;
  userInitials?: string;
};

export default function MessageBubble({ message, userInitials }: MessageBubbleProps) {
  const t = useTranslations("chat.v2.messageActions");
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"helpful" | "notQuite" | null>(null);
  const isUser = message.sender_type === "user";

  const handleCopy = async () => {
    const ok = await safeClipboardWrite(message.content);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const handleFeedback = (kind: "helpful" | "notQuite") => {
    // Toggle off if the same value is clicked twice. Feedback is local-only
    // for now — there's no backend endpoint to persist it.
    const next = feedback === kind ? null : kind;
    setFeedback(next);
    if (next) toast({ title: t("thanks") });
  };

  if (isUser) {
    return (
      <div className="group animate-fade-in flex items-start justify-end gap-2.5">
        <div className="max-w-[540px] min-w-0">
          <div
            className="bg-foreground text-background"
            style={{
              borderTopRightRadius: 4,
              borderTopLeftRadius: 14,
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
              padding: "12px 16px",
            }}
          >
            <div className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.5]">
              {message.content}
            </div>
          </div>
          <p className="mt-1 text-right font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {formatMessageTime(message.timestamp)}
          </p>
        </div>
        <span
          aria-hidden
          className="mt-1 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-border bg-secondary text-[11px] font-semibold text-secondary-foreground"
        >
          {userInitials ?? initialsOf()}
        </span>
      </div>
    );
  }

  return (
    <div className="group animate-fade-in flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-1 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
      >
        M
      </span>
      <div className="min-w-0 max-w-[540px]">
        <p className="mb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-primary">
          MindEase
        </p>
        <div
          className={cn(
            "border border-border bg-card text-foreground",
            message.is_crisis_flagged && "border-l-[3px] border-l-destructive",
          )}
          style={{
            borderTopLeftRadius: 4,
            borderTopRightRadius: 14,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            padding: "12px 16px",
          }}
        >
          <div className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.55]">
            {renderSimpleMarkdown(message.content)}
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {formatMessageTime(message.timestamp)}
          </p>
          <div
            className={cn(
              "flex items-center gap-1 transition-opacity",
              feedback || copied ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <ActionButton
              aria-label={t("helpful")}
              active={feedback === "helpful"}
              onClick={() => handleFeedback("helpful")}
            >
              <ThumbsUp className="h-3 w-3" strokeWidth={1.8} />
              {t("helpful")}
            </ActionButton>
            <ActionButton
              aria-label={t("notQuite")}
              active={feedback === "notQuite"}
              onClick={() => handleFeedback("notQuite")}
            >
              <ThumbsDown className="h-3 w-3" strokeWidth={1.8} />
              {t("notQuite")}
            </ActionButton>
            <ActionButton
              aria-label={copied ? t("copied") : t("copy")}
              onClick={handleCopy}
              active={copied}
            >
              {copied ? (
                <Check className="h-3 w-3" strokeWidth={1.8} />
              ) : (
                <Copy className="h-3 w-3" strokeWidth={1.8} />
              )}
              {copied ? t("copied") : t("copy")}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  active = false,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors",
        active
          ? "bg-accent text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
