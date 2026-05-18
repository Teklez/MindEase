"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const here = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((here - start) / (24 * 60 * 60 * 1000));
}

export default function DailyReflection() {
  const t = useTranslations("dashboard.v2.reflection");
  const locale = useLocale();
  const prompts = t.raw("prompts") as string[];
  const [now, setNow] = useState<Date | null>(null);
  const [saved, setSaved] = useState(false);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const idx = useMemo(() => {
    if (!now) return 0;
    return (dayOfYear(now) + seed) % prompts.length;
  }, [now, prompts.length, seed]);

  const prompt = prompts[idx] ?? prompts[0];

  const dayName = now
    ? new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-US", { weekday: "long" }).format(now)
    : "";

  const handleSave = () => {
    setSaved(true);
    toast({ title: t("saved"), description: prompt });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6" suppressHydrationWarning>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {t("eyebrow")}
      </p>
      <blockquote className="mt-3.5 font-serif text-[22px] font-[360] leading-snug tracking-[-0.005em] text-foreground">
        <span
          aria-hidden
          className="mr-1 align-[-8px] font-serif text-5xl italic leading-[0.5] text-primary"
        >
          &ldquo;
        </span>
        {prompt}
      </blockquote>
      <cite className="mt-3.5 block font-mono text-[11px] uppercase not-italic tracking-[0.1em] text-muted-foreground">
        {t("attribution", { day: dayName })}
      </cite>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <PillButton onClick={handleSave} active={saved}>
          {saved ? t("saved") : t("save")}
        </PillButton>
        <PillButton onClick={() => setSeed((s) => s + 1)}>{t("newPrompt")}</PillButton>
        <PillButton
          onClick={() => {
            window.location.href = "/chat";
          }}
        >
          {t("talkAbout")}
        </PillButton>
      </div>
    </section>
  );
}

function PillButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border bg-secondary px-3 py-1.5 text-[12.5px] text-foreground transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}
