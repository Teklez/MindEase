"use client";

import {
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Phone,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CrisisResources } from "@/lib/types";
import {
  getCrisisResources,
  type CrisisResource,
} from "@/lib/crisis-resources";

type CrisisBannerProps = {
  // Optional WebSocket-pushed resource payload — when present its phone /
  // international entries take precedence over the locale defaults.
  resources?: CrisisResources | null;
  onDismiss: () => void;
};

// Single source of red. oklch keeps the same warmth as the original banner
// while letting us derive border/text variants via color-mix.
const RED = "oklch(0.55 0.14 35)";
const RED_BG = "oklch(0.95 0.04 35)";
const RED_TEXT = "oklch(0.42 0.14 35)";

function resourcesFor(
  ws: CrisisResources | null | undefined,
  locale: string,
): CrisisResource[] {
  if (ws) {
    const out: CrisisResource[] = [];
    const eth = ws.ethiopia?.[0];
    if (eth?.phone) {
      out.push({
        id: "ws-et",
        locale: "et",
        name: eth.name,
        contact: eth.phone,
        type: "phone",
        href: `tel:${eth.phone.replace(/\D/g, "")}`,
      });
    }
    const intl =
      ws.international?.find((r) => r.url) ?? ws.international?.[0];
    if (intl) {
      const intlPhone = (intl as { phone?: string }).phone;
      const href = intl.url ?? (intlPhone ? `tel:${intlPhone}` : "#");
      out.push({
        id: "ws-intl",
        locale: "intl",
        name: intl.name,
        contact: intl.info ?? intl.url ?? intlPhone ?? "",
        type: intl.url ? "url" : "phone",
        href,
      });
    }
    if (out.length > 0) return out;
  }
  return getCrisisResources(locale).slice(0, 2);
}

function iconFor(type: CrisisResource["type"]): LucideIcon {
  if (type === "phone") return Phone;
  if (type === "sms") return MessageSquare;
  return ExternalLink;
}

export default function CrisisBanner({
  resources,
  onDismiss,
}: CrisisBannerProps) {
  const t = useTranslations("chat.v2.crisis");
  const locale = useLocale();
  const items = resourcesFor(resources, locale);

  return (
    <div
      role="alert"
      className="animate-slide-down border-b"
      style={{
        background: RED_BG,
        borderBottomColor: `color-mix(in oklab, ${RED} 25%, transparent)`,
      }}
    >
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2.5 px-5 py-3.5 md:px-6">
        {/* Headline cluster — fixed width on mobile so it doesn't get crowded;
            grows on md+ to push resources + dismiss to the right. */}
        <div className="flex min-w-0 flex-1 basis-full items-center gap-3 md:basis-auto">
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white"
            style={{ background: RED }}
          >
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug text-foreground">
              {t("title")}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {t("sub")}
            </p>
          </div>
        </div>

        {/* Resources — wrap as needed; sit between headline and dismiss. */}
        <div className="flex flex-1 flex-wrap items-center gap-2 md:flex-initial md:justify-end">
          {items.map((r) => {
            const Icon = iconFor(r.type);
            const external = r.type === "url";
            return (
              <a
                key={r.id}
                href={r.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-2 rounded-md border bg-background/80 px-2.5 py-1.5 transition-colors hover:bg-background"
                style={{
                  borderColor: `color-mix(in oklab, ${RED} 35%, transparent)`,
                  color: RED_TEXT,
                }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[12.5px] font-medium">
                    {r.name}
                  </span>
                  <span className="truncate text-[11px] opacity-80">
                    {r.contact}
                  </span>
                </span>
              </a>
            );
          })}
        </div>

        {/* Dismiss — always last in flow; sits at the far right on md+. */}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label={t("imOkay")}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.8} />
          {t("imOkay")}
        </button>
      </div>
    </div>
  );
}
