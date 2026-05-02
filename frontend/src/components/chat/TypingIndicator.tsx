"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function TypingIndicator() {
  return (
    <div className="flex animate-fade-in items-start gap-3">
      <Avatar className="mt-1 h-8 w-8 shrink-0 border border-border bg-card">
        <AvatarFallback className="bg-card text-[10px] font-semibold uppercase tracking-wider text-primary">
          ME
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 max-w-[78%] rounded-2xl rounded-tl-md border border-border bg-muted/60 px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-muted-foreground"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-muted-foreground"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-muted-foreground"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
