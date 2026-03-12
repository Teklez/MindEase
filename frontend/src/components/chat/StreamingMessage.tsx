"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type StreamingMessageProps = {
  tokens: string;
  isComplete: boolean;
};

export default function StreamingMessage({ tokens, isComplete }: StreamingMessageProps) {
  return (
    <div className="flex gap-2 justify-start animate-fade-in">
      <Avatar className="h-8 w-8 shrink-0 border border-border bg-primary/10">
        <AvatarFallback className="text-primary text-xs font-medium">ME</AvatarFallback>
      </Avatar>
      <div className="min-w-0 max-w-[75%] flex-1 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-sm">
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {tokens}
          {!isComplete && (
            <span
              className="inline-block w-0.5 h-4 align-middle bg-primary ml-0.5 animate-blink-cursor"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
}
