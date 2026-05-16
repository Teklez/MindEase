"use client";

import { useTranslations } from "next-intl";
import { CircleCheck, MapPin, Notebook, Wind } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type ActionKey = "breathing" | "journal" | "assessment" | "findHelp";

const ICONS: Record<ActionKey, typeof Wind> = {
  breathing: Wind,
  journal: Notebook,
  assessment: CircleCheck,
  findHelp: MapPin,
};

const ORDER: ActionKey[] = ["breathing", "journal", "assessment", "findHelp"];

export default function QuickActions() {
  const t = useTranslations("dashboard.v2.quickActions");

  const handleClick = (key: ActionKey) => {
    toast({
      title: t("comingSoon"),
      description: `${t(`${key}.title`)} — ${t("comingSoonBody")}`,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ORDER.map((key) => {
        const Icon = ICONS[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            className="group flex flex-col gap-2.5 rounded-2xl border border-border bg-background p-5 text-left transition-colors hover:border-foreground/30"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <span className="text-[14px] font-medium text-foreground">{t(`${key}.title`)}</span>
            <span className="text-[12.5px] leading-[1.5] text-muted-foreground">
              {t(`${key}.sub`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
