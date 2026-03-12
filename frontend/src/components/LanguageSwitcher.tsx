"use client";

import { useRef, useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const locales = [
  { value: "en", label: "English" },
  { value: "am", label: "አማርኛ" },
] as const;

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const next = encodeURIComponent(pathname ?? "/");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch language"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-accent transition-colors"
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span>{locale === "am" ? "አማ" : "EN"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[8rem] rounded-md border bg-popover p-1 shadow-md">
          {locales.map(({ value, label }) => (
            <a
              key={value}
              href={`/set-locale?locale=${value}&next=${next}`}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {locale === value
                ? <Check className="h-4 w-4 shrink-0" />
                : <span className="w-4 shrink-0" aria-hidden />}
              <span>{label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
