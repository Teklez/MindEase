import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

type Stat = { v: string; l: string };

const FACE_PATHS = [
  // Low — sad
  <>
    <circle cx="12" cy="12" r="9" key="c" />
    <path d="M8 16s1.5-2 4-2 4 2 4 2" key="m" />
    <path d="M9 9h.01M15 9h.01" key="e" />
  </>,
  // Off — slight frown
  <>
    <circle cx="12" cy="12" r="9" key="c" />
    <path d="M8 15s1.5-1 4-1 4 1 4 1" key="m" />
    <path d="M9 9h.01M15 9h.01" key="e" />
  </>,
  // Okay — straight
  <>
    <circle cx="12" cy="12" r="9" key="c" />
    <path d="M8 14h8" key="m" />
    <path d="M9 9h.01M15 9h.01" key="e" />
  </>,
  // Good — smile
  <>
    <circle cx="12" cy="12" r="9" key="c" />
    <path d="M8 14s1.5 1.5 4 1.5 4-1.5 4-1.5" key="m" />
    <path d="M9 9h.01M15 9h.01" key="e" />
  </>,
  // Great — laugh
  <>
    <circle cx="12" cy="12" r="9" key="c" />
    <path d="M7.5 13s1.5 3 4.5 3 4.5-3 4.5-3" key="m" />
    <path d="M9 9h.01M15 9h.01" key="e" />
  </>,
];

const HEATMAP = [
  "l1", "l2", "", "l1", "l2", "l3", "l2",
  "l3", "l2", "l3", "l3", "l4", "l3", "l4",
];

const HEATMAP_BG: Record<string, string> = {
  "": "bg-muted/60 border border-border",
  l1: "bg-primary/25",
  l2: "bg-primary/50",
  l3: "bg-primary/75",
  l4: "bg-primary",
};

export default function ProductPreview() {
  const t = useTranslations("landing.v3.preview");
  const chat = t.raw("chat") as Record<string, string>;
  const mood = t.raw("mood") as {
    label: string;
    streak: string;
    title: string;
    sub: string;
    faces: string[];
    stats: Stat[];
    heatmapLabel: string;
  };

  return (
    <section id="preview" className="border-y border-border bg-muted/60 py-24 md:py-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="mb-16 grid items-end gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("eyebrow")}
            </span>
            <h2 className="mt-4 max-w-[14ch] font-serif text-[36px] font-[360] leading-[1.04] tracking-[-0.018em] text-foreground text-balance md:text-[48px]">
              {t("headlineLead")}{" "}
              <em className="font-[360] text-primary" style={{ fontStyle: "italic" }}>
                {t("headlineEm")}
              </em>
            </h2>
          </div>
          <p className="text-[16px] leading-[1.6] text-muted-foreground">{t("intro")}</p>
        </div>

        <div className="grid items-stretch gap-7 lg:grid-cols-[1.15fr_1fr]">
          {/* Chat mock */}
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(20,30,25,0.04),0_30px_60px_-32px_rgba(20,30,25,0.18)]">
            <div className="flex items-center justify-between border-b border-border bg-background px-[18px] py-3.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {chat.label}
              </span>
              <div className="flex gap-1.5">
                <i className="block h-[9px] w-[9px] rounded-full bg-muted" />
                <i className="block h-[9px] w-[9px] rounded-full bg-muted" />
                <i className="block h-[9px] w-[9px] rounded-full bg-muted" />
              </div>
            </div>
            <div className="flex min-h-[380px] flex-col gap-3.5 p-6">
              <div className="max-w-[78%] self-start rounded-[14px] rounded-bl-[4px] bg-primary/15 px-4 py-3 text-[14px] leading-[1.5] text-foreground">
                <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-primary">
                  {chat.who}
                </span>
                {chat.bot1}
              </div>
              <div className="max-w-[78%] self-end rounded-[14px] rounded-br-[4px] bg-foreground px-4 py-3 text-[14px] leading-[1.5] text-background">
                {chat.user1}
              </div>
              <div className="max-w-[78%] self-start rounded-[14px] rounded-bl-[4px] bg-primary/15 px-4 py-3 text-[14px] leading-[1.5] text-foreground">
                <span className="mb-1.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-primary">
                  {chat.who}
                </span>
                {chat.bot2}
              </div>
              <div className="inline-flex w-fit gap-1 self-start rounded-[14px] rounded-bl-[4px] bg-primary/15 px-4 py-3">
                <i className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                <i className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
                <i className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border bg-background px-4 py-3.5">
              <div className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] text-muted-foreground">
                {chat.inputPlaceholder}
              </div>
              <button
                type="button"
                aria-label={chat.send}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Mood mock */}
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(20,30,25,0.04),0_30px_60px_-32px_rgba(20,30,25,0.18)]">
            <div className="flex items-center justify-between border-b border-border bg-background px-[18px] py-3.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {mood.label}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                {mood.streak}
              </span>
            </div>
            <div className="p-6">
              <h4 className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
                {mood.title}
              </h4>
              <div className="mb-5 mt-1 text-[13px] text-muted-foreground">{mood.sub}</div>

              <div className="mb-6 grid grid-cols-5 gap-2">
                {mood.faces.map((label, i) => {
                  const active = i === 2;
                  return (
                    <div
                      key={label}
                      className={
                        "flex aspect-square flex-col items-center justify-center gap-1 rounded-[10px] border transition-colors " +
                        (active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground")
                      }
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {FACE_PATHS[i]}
                      </svg>
                      <span className="font-mono text-[10px] uppercase tracking-[0.06em]">{label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mb-5 grid grid-cols-3 gap-2.5">
                {mood.stats.map((s) => (
                  <div key={s.l} className="rounded-[10px] border border-border p-3">
                    <div className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">
                      {s.v}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {mood.heatmapLabel}
              </div>
              <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                {HEATMAP.map((level, i) => (
                  <i
                    key={i}
                    className={"block aspect-square rounded-[4px] " + (HEATMAP_BG[level] ?? HEATMAP_BG[""])}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
