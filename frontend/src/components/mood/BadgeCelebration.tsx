"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BadgeResponse } from "@/lib/api";

type Props = {
  badges: BadgeResponse[];
  onClose: () => void;
};

export default function BadgeCelebration({ badges, onClose }: Props) {
  const t = useTranslations("mood");
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(close, 5500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
    setTimeout(onClose, 300);
  }

  const badge = badges[current];

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0",
      )}
      role="dialog"
      aria-modal
      aria-labelledby="badge-celebration-title"
    >
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      <div
        className={cn(
          "relative z-10 mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg transition-all duration-300",
          show ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
      >
        <div className="relative flex h-32 items-center justify-center bg-gradient-to-b from-primary/15 via-primary/5 to-transparent">
          <span
            className={cn(
              "select-none text-6xl leading-none",
              show && "animate-soft-glow",
            )}
            aria-hidden
          >
            {badge.icon}
          </span>
        </div>

        <div className="px-6 pb-6 pt-4 text-center">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {t("badgeEarned")}
          </p>
          <h2
            id="badge-celebration-title"
            className="font-serif text-2xl tracking-tight text-foreground"
          >
            {badge.name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{badge.description}</p>

          {badges.length > 1 && (
            <div className="mb-1 mt-5 flex items-center justify-center gap-2">
              {badges.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Badge ${i + 1} of ${badges.length}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === current ? "w-5 bg-primary" : "w-1.5 bg-border",
                  )}
                />
              ))}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            {badges.length > 1 && current < badges.length - 1 && (
              <button
                onClick={() => setCurrent(current + 1)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Next →
              </button>
            )}
            <button
              onClick={close}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("awesome")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
