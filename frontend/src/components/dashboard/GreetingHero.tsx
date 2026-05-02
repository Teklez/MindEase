"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Sparkles } from "lucide-react";

type Props = {
  displayName: string | null;
  daysSinceCheckIn: number | null;
  onQuickCheckIn?: () => void;
};

export default function GreetingHero({ displayName, daysSinceCheckIn, onQuickCheckIn }: Props) {
  const t = useTranslations("dashboard");
  const [hour, setHour] = useState(12);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  const greetKey = hour < 12 ? "welcomeMorning" : hour < 17 ? "welcomeAfternoon" : "welcomeEvening";
  const greeting = displayName ? t(greetKey, { name: displayName }) : t(greetKey, { name: "" });

  const context = (() => {
    if (daysSinceCheckIn === null) return null;
    if (daysSinceCheckIn === 0) return t("contextToday");
    if (daysSinceCheckIn === 1) return t("contextYesterday");
    return t("context", { days: daysSinceCheckIn });
  })();

  return (
    <section className="rounded-2xl border border-border bg-card p-7 shadow-soft-sm md:p-9">
      <h1 className="font-serif text-[34px] leading-[1.08] tracking-tight text-foreground md:text-[44px]">
        {greeting.replace(/[!,]+$/, "")}
        <span className="text-primary">.</span>
      </h1>
      {context && <p className="mt-3 text-[15px] text-muted-foreground md:text-base">{context}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-px hover:bg-primary/90 shadow-soft-sm"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          {t("startSession")}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Link>
        <button
          type="button"
          onClick={onQuickCheckIn}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-all hover:-translate-y-px hover:bg-muted"
        >
          {t("quickCheckIn")}
        </button>
      </div>
    </section>
  );
}
