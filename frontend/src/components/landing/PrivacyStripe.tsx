import { useTranslations } from "next-intl";
import { Lock, FileLock2, LifeBuoy } from "lucide-react";

const ICONS = [Lock, FileLock2, LifeBuoy];

type Item = { title: string; body: string };

export default function PrivacyStripe() {
  const t = useTranslations("landing.v2.privacy");
  const items = t.raw("items") as Item[];

  return (
    <section id="privacy" className="border-y border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-20 md:px-8 md:py-24 lg:px-12">
        <h2 className="font-serif text-[28px] leading-tight tracking-tight text-foreground md:text-[36px]">
          {t("title")}
        </h2>
        <ul className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
          {items.map((item, i) => {
            const Icon = ICONS[i] ?? Lock;
            return (
              <li key={item.title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
