"use client";

type StreamingMessageProps = {
  tokens: string;
  isComplete: boolean;
};

export default function StreamingMessage({ tokens, isComplete }: StreamingMessageProps) {
  return (
    <div className="animate-fade-in flex items-start gap-2.5">
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
          className="border border-border bg-card text-foreground"
          style={{
            borderTopLeftRadius: 4,
            borderTopRightRadius: 14,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            padding: "12px 16px",
          }}
        >
          <div className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.55]">
            {tokens}
            {!isComplete && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-4 w-[2px] animate-blink-cursor align-middle bg-primary"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
