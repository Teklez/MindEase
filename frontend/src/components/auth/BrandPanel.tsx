import type { ReactNode } from "react";
import Link from "next/link";

function LeafMark() {
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21c0-7 4-12 9-13-1 9-5 13-9 13Z" />
        <path d="M12 21c0-5-3-9-8-10 1 7 4 10 8 10Z" />
      </svg>
    </span>
  );
}

type BrandPanelProps = {
  photoSrc: string;
  eyebrow: string;
  headlineLead: string;
  headlineEm: string;
  subcopy: string;
  quote?: { text: string; attribution: string; avatar: string };
  footStart?: ReactNode;
  footEnd?: ReactNode;
};

export default function BrandPanel({
  photoSrc,
  eyebrow,
  headlineLead,
  headlineEm,
  subcopy,
  quote,
  footStart,
  footEnd,
}: BrandPanelProps) {
  const defaultFootEnd = (
    <span className="flex items-center gap-3">
      <Link
        href="/privacy"
        className="border-b border-background/20 pb-[1px] text-background/85 transition-colors hover:text-background"
      >
        Privacy
      </Link>
      <span aria-hidden>·</span>
      <Link
        href="/terms"
        className="border-b border-background/20 pb-[1px] text-background/85 transition-colors hover:text-background"
      >
        Terms
      </Link>
    </span>
  );

  return (
    <aside className="relative hidden overflow-hidden text-background lg:flex lg:flex-col lg:p-11">
      {/* Photo bg */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${photoSrc}')` }}
      />
      {/* Dark gradient overlay */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, hsl(160 14% 12% / 0.45) 0%, hsl(160 14% 12% / 0.62) 55%, hsl(160 14% 8% / 0.86) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full min-h-[640px] flex-col">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-serif text-[22px] font-medium tracking-[-0.01em] text-background"
        >
          <LeafMark />
          MindEase
        </Link>

        {/* Bottom block — anchored toward bottom via mt-auto on eyebrow */}
        <span className="mt-auto font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-background/75">
          {eyebrow}
        </span>
        <h1 className="mt-3.5 max-w-[12ch] font-serif text-[44px] font-[360] leading-[1.04] tracking-[-0.018em] text-background lg:text-[52px]">
          {headlineLead}{" "}
          <em
            className="font-[360] text-background/80"
            style={{ fontStyle: "italic" }}
          >
            {headlineEm}
          </em>
        </h1>
        <p className="mt-4 max-w-[38ch] text-[15px] leading-[1.6] text-background/85">
          {subcopy}
        </p>

        {quote ? (
          <div className="mt-6 rounded-[10px] border border-background/25 bg-foreground/55 p-5 backdrop-blur-md">
            <div className="font-serif text-[16px] font-[360] leading-[1.45] tracking-[-0.005em] text-background">
              &ldquo;{quote.text}&rdquo;
            </div>
            <div className="mt-3.5 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-background/75">
              <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {quote.avatar}
              </span>
              {quote.attribution}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-background/25 pt-[18px] text-[12px] text-background/75">
          <span>{footStart ?? null}</span>
          <span>{footEnd ?? defaultFootEnd}</span>
        </div>
      </div>
    </aside>
  );
}
