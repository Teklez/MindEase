import { useTranslations } from "next-intl";

export default function TrustStrip() {
  const t = useTranslations("landing.v3.trust");
  const items = t.raw("items") as string[];

  return (
    <section className="border-y border-border bg-muted/60">
      <div className="mx-auto max-w-[1240px] px-10">
        <div className="grid items-center gap-8 py-[22px] text-muted-foreground sm:grid-cols-2 md:grid-cols-[auto_repeat(5,1fr)]">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
            {t("label")}
          </span>
          {items.map((item) => (
            <span
              key={item}
              className="font-serif text-[17px] font-normal tracking-[-0.005em] text-foreground/80"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
