"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  asLink?: boolean;
};

export default function Logo({ size = "md", className, asLink = true }: LogoProps) {
  const content = (
    <span
      className={cn("font-medium tracking-tight", sizeClasses[size], className)}
    >
      <span className="font-normal text-foreground">Mind</span>
      <span className="text-primary font-medium">Ease</span>
    </span>
  );

  if (asLink) {
    return (
      <Link href="/dashboard" className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
