"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BadgeResponse } from "@/lib/api";

interface Props {
  badges: BadgeResponse[];
  onClose: () => void;
}

const CONFETTI = [
  { color: "bg-yellow-400", left: "8%", delay: "0ms", duration: "700ms" },
  { color: "bg-pink-400", left: "18%", delay: "80ms", duration: "900ms" },
  { color: "bg-blue-400", left: "28%", delay: "40ms", duration: "800ms" },
  { color: "bg-green-400", left: "40%", delay: "120ms", duration: "750ms" },
  { color: "bg-purple-400", left: "52%", delay: "60ms", duration: "850ms" },
  { color: "bg-orange-400", left: "63%", delay: "100ms", duration: "700ms" },
  { color: "bg-pink-300", left: "74%", delay: "30ms", duration: "920ms" },
  { color: "bg-teal-400", left: "84%", delay: "150ms", duration: "780ms" },
] as const;

export default function BadgeCelebration({ badges, onClose }: Props) {
  const t = useTranslations("mood");
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    timerRef.current = setTimeout(close, 5000);
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
        show ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal
      aria-labelledby="badge-celebration-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Card */}
      <div
        className={cn(
          "relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden",
          "transition-all duration-300",
          show ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        {/* Confetti header */}
        <div className="relative h-20 overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-primary/10">
          {CONFETTI.map((piece, i) => (
            <div
              key={i}
              className={cn("absolute top-0 w-2 h-2 rounded-sm animate-bounce", piece.color)}
              style={{
                left: piece.left,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
              }}
            />
          ))}
          {/* Badge icon centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-5xl leading-none select-none animate-bounce"
              style={{ animationDuration: "1s" }}
            >
              {badge.icon}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {t("badgeEarned")}
          </p>
          <h2
            id="badge-celebration-title"
            className="text-xl font-bold text-foreground mb-1"
          >
            {badge.name}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">{badge.description}</p>

          {/* Pagination dots for multiple badges */}
          {badges.length > 1 && (
            <div className="flex items-center justify-center gap-2 mb-4">
              {badges.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Badge ${i + 1} of ${badges.length}`}
                  className={cn(
                    "rounded-full transition-all duration-200 h-2",
                    i === current ? "bg-primary w-5" : "bg-border w-2"
                  )}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {badges.length > 1 && current < badges.length - 1 && (
              <button
                onClick={() => setCurrent(current + 1)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Next →
              </button>
            )}
            <button
              onClick={close}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t("awesome")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
