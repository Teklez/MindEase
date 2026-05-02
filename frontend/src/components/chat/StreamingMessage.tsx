"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type StreamingMessageProps = {
  tokens: string;
  isComplete: boolean;
};

export default function StreamingMessage({ tokens, isComplete }: StreamingMessageProps) {
  return (
    <div className="flex animate-fade-in items-start gap-3">
      <Avatar className="mt-1 h-8 w-8 shrink-0 border border-border bg-card">
        <AvatarFallback className="bg-card text-[10px] font-semibold uppercase tracking-wider text-primary">
          ME
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 max-w-[78%] flex-1 rounded-2xl rounded-tl-md border border-border bg-muted/60 px-4 py-3">
        <div className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-foreground">
          {tokens}
          {!isComplete && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-4 w-0.5 animate-blink-cursor align-middle bg-primary"
            />
          )}
        </div>
      </div>
    </div>
  );
}
