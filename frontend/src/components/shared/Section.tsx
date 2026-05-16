import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionSize = "default" | "compact" | "hero" | "wide";

const sizeClasses: Record<SectionSize, string> = {
  default: "py-20 md:py-28",
  compact: "py-16 md:py-20",
  hero: "pb-20 pt-16 md:pb-32 md:pt-24",
  wide: "py-24 md:py-32",
};

type SectionProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  size?: SectionSize;
  containerClassName?: string;
  children: ReactNode;
};

export function Section({
  as: Tag = "section",
  size = "default",
  className,
  containerClassName,
  children,
  ...rest
}: SectionProps) {
  return (
    <Tag className={className} {...rest}>
      <div
        className={cn(
          "mx-auto max-w-7xl px-6 md:px-8 lg:px-12",
          sizeClasses[size],
          containerClassName,
        )}
      >
        {children}
      </div>
    </Tag>
  );
}
