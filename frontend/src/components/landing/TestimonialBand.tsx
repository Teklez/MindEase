import { useTranslations } from "next-intl";

export default function TestimonialBand() {
  const t = useTranslations("landing.v2.testimonial");
  return (
    <section className="bg-primary/[0.07]">
      <div className="mx-auto max-w-5xl px-6 py-24 text-center md:px-8 md:py-32 lg:px-12">
        <svg
          aria-hidden
          width="44"
          height="36"
          viewBox="0 0 44 36"
          fill="none"
          className="mx-auto text-primary/40"
        >
          <path
            d="M0 36V21.6C0 14.4 1.6 8.8 4.8 4.8 8 1.6 12.8 0 19.2 0v8c-3.2 0-5.6.8-7.2 2.4C10.4 12 9.6 14.4 9.6 17.6h9.6V36H0Zm24.8 0V21.6c0-7.2 1.6-12.8 4.8-16.8C32.8 1.6 37.6 0 44 0v8c-3.2 0-5.6.8-7.2 2.4-1.6 1.6-2.4 4-2.4 7.2H44V36H24.8Z"
            fill="currentColor"
          />
        </svg>
        <blockquote className="mt-8 font-serif text-[30px] leading-[1.25] tracking-tight text-foreground sm:text-[40px] md:text-[44px]">
          {t("quote")}
        </blockquote>
        <p className="mt-8 text-sm uppercase tracking-[0.14em] text-muted-foreground">
          {t("attribution")}
        </p>
      </div>
    </section>
  );
}
