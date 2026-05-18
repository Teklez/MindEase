"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Props = {
  displayName: string | null;
  streak: number | null;
};

type Period = "morning" | "afternoon" | "evening" | "night";

function periodOf(hour: number): Period {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

export default function GreetingHero({ displayName, streak }: Props) {
  const t = useTranslations("dashboard.v2");
  const locale = useLocale();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const hour = now?.getHours() ?? 12;
  const period = periodOf(hour);

  const dayName = now
    ? new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-US", { weekday: "long" }).format(now)
    : "";

  const dateLabel = now
    ? new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(now)
    : "";

  const clock = now
    ? `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    : "";

  const eyebrow = t(`eyebrow.${period}`, { day: dayName });
  const greetingLead = t(`greeting.${period}Lead`);
  const streakLine = streak && streak > 0 ? t("streakLine", { streak }) : t("noStreakLine");

  return (
    <section className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-7" suppressHydrationWarning>
      <div className="min-w-0 flex-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </span>
        <h1 className="mt-3 font-serif text-[36px] font-[360] leading-[1.06] tracking-[-0.018em] text-foreground md:text-[44px]">
          {greetingLead}{" "}
          <em className="font-[360] text-primary" style={{ fontStyle: "italic" }}>
            {displayName ?? "friend"}.
          </em>
        </h1>
        <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.6] text-muted-foreground">
          {streakLine}
        </p>
      </div>
      <div className="min-w-[180px] whitespace-nowrap text-right">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {dateLabel}
        </div>
        <div className="mt-1 font-serif text-[22px] font-[360] tracking-[-0.01em] text-foreground">
          {clock}
        </div>
      </div>
    </section>
  );
}
