"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MoodCheckIn from "@/components/mood/MoodCheckIn";
import { cn } from "@/lib/utils";

type FaceKey = "veryLow" | "low" | "okay" | "good" | "great";

const FACE_PATHS: Record<FaceKey, JSX.Element> = {
  veryLow: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 16s1.5-2 4-2 4 2 4 2" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  low: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 15s1.5-1 4-1 4 1 4 1" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  okay: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14h8" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  good: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 1.5 4 1.5 4-1.5 4-1.5" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  great: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 13s1.5 3 4.5 3 4.5-3 4.5-3" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
};

const FACE_ORDER: FaceKey[] = ["veryLow", "low", "okay", "good", "great"];

type Props = {
  onMoodLogged?: () => void;
};

export default function MoodCheckInCard({ onMoodLogged }: Props) {
  const t = useTranslations("dashboard.v2.checkIn");
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-secondary to-card p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-primary/30 opacity-40 blur-3xl"
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0">
            <h3 className="font-serif text-[22px] font-[360] tracking-[-0.01em] text-foreground">
              {t("title")}
            </h3>
            <p className="mt-1 text-[14px] text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            {FACE_ORDER.map((face) => (
              <button
                key={face}
                type="button"
                onClick={() => setOpen(true)}
                title={t(`faces.${face}`)}
                aria-label={t(`faces.${face}`)}
                className={cn(
                  "group grid h-11 w-11 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-all",
                  "hover:-translate-y-0.5 hover:border-primary hover:text-primary hover:shadow-soft-sm",
                )}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {FACE_PATHS[face]}
                </svg>
              </button>
            ))}
          </div>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-[22px] font-[360]">{t("title")}</DialogTitle>
          </DialogHeader>
          <MoodCheckIn
            onEntryCreated={() => {
              setOpen(false);
              onMoodLogged?.();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
