"use client";

import { Sparkles } from "lucide-react";
import type { GroupMessageResponse } from "@/lib/types";
import { cn, formatMessageTime } from "@/lib/utils";

interface Props {
  message: GroupMessageResponse;
  isCurrentUser: boolean;
  lang: string;
}

// Deterministic palette so the same user keeps the same color across renders.
// Colors are tuned to coexist with the sage/teal app palette.
const AVATAR_PALETTE = [
  { bg: "#F59E0B", text: "#FFFFFF" }, // amber
  { bg: "#10B981", text: "#FFFFFF" }, // emerald
  { bg: "#8B5CF6", text: "#FFFFFF" }, // violet
  { bg: "#EC4899", text: "#FFFFFF" }, // pink
  { bg: "#6366F1", text: "#FFFFFF" }, // indigo
  { bg: "#0EA5E9", text: "#FFFFFF" }, // sky
  { bg: "#EF4444", text: "#FFFFFF" }, // red
  { bg: "#14B8A6", text: "#FFFFFF" }, // teal
  { bg: "#A855F7", text: "#FFFFFF" }, // purple
  { bg: "#F97316", text: "#FFFFFF" }, // orange
];

function hashStringToIndex(input: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % modulo;
}

function colorForUser(userId: string | null): { bg: string; text: string } {
  if (!userId) return { bg: "#6B7280", text: "#FFFFFF" };
  return AVATAR_PALETTE[hashStringToIndex(userId, AVATAR_PALETTE.length)];
}

function initialOf(name: string | null | undefined): string {
  if (!name) return "?";
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

export function GroupMessageBubble({ message, isCurrentUser }: Props) {
  // ----- system -----
  if (message.sender_type === "system") {
    return (
      <div className="flex animate-fade-in justify-center px-3 py-1">
        <span className="rounded-full bg-muted/50 px-3 py-1 text-[11px] italic text-muted-foreground">
          — {message.content} —
        </span>
      </div>
    );
  }

  // ----- ai_moderator -----
  if (message.sender_type === "ai_moderator") {
    return (
      <div className="flex animate-fade-in items-start gap-3">
        <div
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden
        >
          <span className="text-[10px] font-bold tracking-wider">ME</span>
        </div>
        <div className="max-w-[82%] flex-1">
          <p className="mb-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            {message.sender_name || "MindEase"}
          </p>
          <div className="rounded-2xl rounded-tl-md border border-primary/20 bg-primary/[0.06] px-4 py-3">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground">
              {message.content}
            </p>
            <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {formatMessageTime(message.timestamp)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isDeleted = (message as GroupMessageResponse & { is_deleted?: boolean })
    .is_deleted;

  // ----- current user (right aligned) -----
  if (isCurrentUser) {
    return (
      <div className="flex animate-fade-in justify-end">
        <div
          className={cn(
            "max-w-[78%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground shadow-soft-sm",
            message.is_crisis_flagged && "border-l-2 border-l-destructive",
          )}
        >
          <div
            className={cn(
              "whitespace-pre-wrap break-words text-[14.5px] leading-relaxed",
              isDeleted && "italic opacity-70",
            )}
          >
            {isDeleted ? "[Message deleted]" : message.content}
          </div>
          <p className="mt-1.5 text-right text-[10px] uppercase tracking-wider text-primary-foreground/70">
            {formatMessageTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // ----- other user (left aligned) -----
  const palette = colorForUser(message.user_id);
  return (
    <div className="flex animate-fade-in items-start gap-3">
      <div
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
        style={{ backgroundColor: palette.bg, color: palette.text }}
        aria-hidden
      >
        {initialOf(message.sender_name)}
      </div>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-soft-sm",
          message.is_crisis_flagged && "border-l-2 border-l-destructive",
        )}
      >
        {message.sender_name && (
          <p
            className="mb-1 text-[12px] font-semibold"
            style={{ color: palette.bg }}
          >
            {message.sender_name}
          </p>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-foreground",
            isDeleted && "italic text-muted-foreground",
          )}
        >
          {isDeleted ? "[Message deleted]" : message.content}
        </div>
        <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatMessageTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
