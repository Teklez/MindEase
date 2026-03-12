"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function TypingIndicator() {
  return (
    <div className="flex gap-2 justify-start animate-fade-in">
      <Avatar className="h-8 w-8 shrink-0 border border-border bg-primary/10">
        <AvatarFallback className="text-primary text-xs font-medium">ME</AvatarFallback>
      </Avatar>
      <div className="min-w-0 max-w-[75%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 py-1">
          <span
            className="h-2 w-2 rounded-full bg-primary animate-bounce-dot"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-primary animate-bounce-dot"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-2 w-2 rounded-full bg-primary animate-bounce-dot"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
