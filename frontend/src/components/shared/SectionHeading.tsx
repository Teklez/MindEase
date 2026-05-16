import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionHeadingSize = "default" | "small" | "large";

const sizeClasses: Record<SectionHeadingSize, string> = {
  small: "text-[28px] sm:text-[34px] md:text-[40px]",
  default: "text-[36px] sm:text-[44px] md:text-[52px]",
  large: "text-[40px] sm:text-[52px] md:text-[60px]",
};

type SectionHeadingProps = {
  lead: ReactNode;
  emphasis?: ReactNode;
  align?: "left" | "center";
  size?: SectionHeadingSize;
  className?: string;
  as?: "h1" | "h2" | "h3";
};

export function SectionHeading({
  lead,
  emphasis,
  align = "left",
  size = "default",
  className,
  as: Tag = "h2",
}: SectionHeadingProps) {
  return (
    <Tag
      className={cn(
        "font-serif leading-[1.08] tracking-tight text-foreground",
        sizeClasses[size],
        align === "center" && "text-center",
        className,
      )}
    >
      {lead}
      {emphasis ? (
        <>
          {" "}
          <em className="text-primary">{emphasis}</em>
        </>
      ) : null}
    </Tag>
  );
}
