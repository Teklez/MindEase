"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: { wordmark: "text-base", glyph: "h-5 w-5", icon: 12 },
  md: { wordmark: "text-lg", glyph: "h-7 w-7", icon: 14 },
  lg: { wordmark: "text-2xl", glyph: "h-9 w-9", icon: 18 },
} as const;

type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  asLink?: boolean;
  href?: string;
  variant?: "default" | "light";
};

function LeafGlyph({ size, variant }: { size: number; variant: "default" | "light" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={variant === "light" ? "text-primary" : "text-primary-foreground"}
    >
      <path d="M12 21c0-7 4-12 9-13-1 9-5 13-9 13Z" />
      <path d="M12 21c0-5-3-9-8-10 1 7 4 10 8 10Z" />
    </svg>
  );
}

export default function Logo({
  size = "md",
  className,
  asLink = true,
  href = "/dashboard",
  variant = "default",
}: LogoProps) {
  const s = sizeClasses[size];
  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-md shrink-0",
          s.glyph,
          variant === "light" ? "bg-card text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        <LeafGlyph size={s.icon} variant={variant} />
      </span>
      <span
        className={cn(
          "font-serif font-medium tracking-tight",
          s.wordmark,
          variant === "light" ? "text-card" : "text-foreground",
        )}
      >
        MindEase
      </span>
    </span>
  );

  if (asLink) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
