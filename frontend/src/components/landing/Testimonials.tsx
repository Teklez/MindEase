import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

type Item = {
  quoteLead: string;
  quoteEm: string;
  quoteTrail: string;
  name: string;
  role: string;
};

// TODO: replace Unsplash hotlinks with approved imagery in public/landing/ before launch.
const AVATARS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=70",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=120&q=70",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=120&q=70",
];

export default function Testimonials() {
  const t = useTranslations("landing.v3.testimonials");
  const items = t.raw("items") as Item[];

  return (
    <section
      id="testimonials"
      className="border-y border-border bg-muted/60 py-24 md:py-[120px]"
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 md:px-10">
        <div className="grid items-end gap-12 md:grid-cols-2 md:gap-16">
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

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <article
              key={item.name}
              className="flex min-h-[280px] flex-col gap-5 rounded-2xl border border-border bg-background p-7"
            >
              <div className="flex gap-0.5 text-primary" aria-label="5 out of 5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <blockquote className="flex-1 font-serif text-[19px] font-[360] leading-[1.5] tracking-[-0.005em] text-foreground">
                &ldquo;{item.quoteLead}{" "}
                <em style={{ fontStyle: "italic" }}>{item.quoteEm}</em>
                {item.quoteTrail ? <> {item.quoteTrail}</> : null}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <div className="h-10 w-10 flex-none overflow-hidden rounded-full bg-primary/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={AVATARS[i]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-semibold text-foreground">{item.name}</span>
                  <span className="text-[12px] text-muted-foreground">{item.role}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
