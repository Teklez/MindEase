"use client";

import { AlertTriangle, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CrisisResources } from "@/lib/types";
import { getCrisisResources } from "@/lib/crisis-resources";

type Pill = { label: string; href?: string };

type CrisisBannerProps = {
  // Optional WebSocket-pushed resource payload — when present its phone /
  // international entries take precedence over the locale defaults.
  resources?: CrisisResources | null;
  onDismiss: () => void;
};

function pillsFor(
  resources: CrisisResources | null | undefined,
  locale: string,
): Pill[] {
  // 1) Prefer the WebSocket-pushed shape if it carries phone + international.
  if (resources) {
    const out: Pill[] = [];
    const eth = resources.ethiopia?.[0];
    if (eth) out.push({ label: `Ethiopia · ${eth.phone}`, href: `tel:${eth.phone.replace(/\D/g, "")}` });
    const intl = resources.international?.find((r) => r.url) ?? resources.international?.[0];
    if (intl) out.push({ label: intl.name, href: intl.url });
    if (out.length > 0) return out;
  }
  // 2) Locale-derived from the shared crisis-resources lib.
  return getCrisisResources(locale)
    .slice(0, 2)
    .map((r) => ({ label: r.contact, href: r.href }));
}

export default function CrisisBanner({ resources, onDismiss }: CrisisBannerProps) {
  const t = useTranslations("chat.v2.crisis");
  const locale = useLocale();
  const pills = pillsFor(resources, locale);

  return (
    <div
      role="alert"
      className="animate-slide-down grid grid-cols-[auto_1fr_auto] items-center gap-3.5 border-b px-6 py-3.5 md:grid-cols-[auto_1fr_auto_auto]"
      style={{
        background: "oklch(0.95 0.04 35)",
        borderBottomColor: "color-mix(in oklab, oklch(0.55 0.14 35) 25%, transparent)",
      }}
    >
      <div
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-full text-white"
        style={{ background: "oklch(0.55 0.14 35)" }}
      >
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <b className="text-[14px] font-semibold text-foreground">{t("title")}</b>
        <span className="mt-0.5 block font-mono text-[10.5px] tracking-[0.06em] text-foreground/85">
          {t("sub")}
        </span>
      </div>
      <div className="hidden gap-2 md:flex">
        {pills.map((p, i) =>
          p.href ? (
            <a
              key={i}
              href={p.href}
              target={p.href.startsWith("http") ? "_blank" : undefined}
              rel={p.href.startsWith("http") ? "noreferrer" : undefined}
              className="inline-flex items-center rounded-full border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] transition-colors hover:bg-foreground/5"
              style={{
                borderColor: "color-mix(in oklab, oklch(0.55 0.14 35) 35%, transparent)",
                color: "oklch(0.42 0.14 35)",
              }}
            >
              {p.label}
            </a>
          ) : (
            <span
              key={i}
              className="inline-flex items-center rounded-full border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em]"
              style={{
                borderColor: "color-mix(in oklab, oklch(0.55 0.14 35) 35%, transparent)",
                color: "oklch(0.42 0.14 35)",
              }}
            >
              {p.label}
            </span>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.8} />
        {t("imOkay")}
      </button>
    </div>
  );
}
