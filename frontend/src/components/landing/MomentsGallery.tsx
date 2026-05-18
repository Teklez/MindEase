import { useTranslations } from "next-intl";

// TODO: replace Unsplash hotlinks with approved imagery in public/landing/ before launch.
const PHOTOS = [
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=70",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1493957988430-a5f2e15f39a3?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=70",
];

const POSITIONS = [
  "col-start-1 col-end-2 row-start-1 row-end-3",
  "col-start-2 col-end-3 row-start-1 row-end-2",
  "col-start-3 col-end-4 row-start-1 row-end-2",
  "col-start-2 col-end-3 row-start-2 row-end-3",
  "col-start-3 col-end-4 row-start-2 row-end-3",
];

export default function MomentsGallery() {
  const t = useTranslations("landing.v3.moments");
  const captions = t.raw("captions") as string[];
  const alts = t.raw("alts") as string[];

  return (
    <section id="moments" className="pb-24 md:pb-[120px]">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[56ch]">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t("eyebrow")}
            </span>
            <h2 className="mt-4 font-serif text-[36px] font-[360] leading-[1.04] tracking-[-0.018em] text-foreground text-balance md:text-[48px]">
              {t("headlineLead")}{" "}
              <em className="font-[360] text-primary" style={{ fontStyle: "italic" }}>
                {t("headlineEm")}
              </em>{" "}
              {t("headlineTrail")}
            </h2>
          </div>
          <p className="max-w-[36ch] text-[15px] leading-[1.6] text-muted-foreground">
            {t("intro")}
          </p>
        </div>

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "1.4fr 1fr 1fr",
            gridTemplateRows: "220px 220px",
          }}
        >
          {captions.map((cap, i) => (
            <div
              key={cap}
              className={
                "group relative overflow-hidden rounded-2xl border border-border bg-muted " +
                POSITIONS[i]
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PHOTOS[i]}
                alt={alts[i] ?? cap}
                className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
              />
              <span className="absolute bottom-3.5 left-3.5 rounded-full bg-foreground/55 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-background backdrop-blur-sm">
                {cap}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
