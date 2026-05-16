"use client";

export default function TypingIndicator() {
  return (
    <div className="animate-fade-in flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-1 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
      >
        M
      </span>
      <div
        className="border border-border bg-card"
        style={{
          borderTopLeftRadius: 4,
          borderTopRightRadius: 14,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          padding: "14px 18px",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-primary"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-primary"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-primary"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
