"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/relative-time";
import type { GroupListItem } from "@/lib/types";

interface Props {
  group: GroupListItem;
  lang: string;
  onJoin: (groupId: string) => Promise<{ ok: boolean; error?: string } | void>;
  onOpen: (groupId: string) => void;
}

export function GroupCard({ group, lang, onJoin, onOpen }: Props) {
  const t = useTranslations("groups");
  const [joining, setJoining] = useState(false);

  const isAm = lang === "am";
  const name = isAm && group.name_am ? group.name_am : group.name;
  const description =
    isAm && group.description_am ? group.description_am : group.description;
  const coverColor = group.cover_color ?? "#4A90A4";

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (joining) return;
    setJoining(true);
    try {
      await onJoin(group.group_id);
    } finally {
      setJoining(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen(group.group_id);
  };

  const handleCardClick = () => {
    if (group.is_member) onOpen(group.group_id);
  };

  return (
    <Card
      role={group.is_member ? "button" : undefined}
      tabIndex={group.is_member ? 0 : undefined}
      onClick={group.is_member ? handleCardClick : undefined}
      onKeyDown={
        group.is_member
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(group.group_id);
              }
            }
          : undefined
      }
      className={cn(
        "group flex h-full flex-col overflow-hidden p-0 transition-all",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        group.is_member &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div
        className="h-2 w-full shrink-0"
        style={{ backgroundColor: coverColor }}
        aria-hidden
      />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: `${coverColor}1A` }}
            aria-hidden
          >
            {group.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-1 font-serif text-[17px] leading-snug text-foreground">
                <span className="inline-flex items-center gap-2">
                  {group.has_unread && group.is_member && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label={t("unreadAriaLabel")}
                    />
                  )}
                  {name}
                </span>
              </h3>
              {group.is_member && (
                <span
                  className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                >
                  {t("member")}
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
            {t("members", { count: group.member_count })}
          </span>
          {group.last_activity ? (
            <span className="text-[11px]">
              {t("active", { time: relativeTime(group.last_activity) })}
            </span>
          ) : (
            <span className="text-[11px] italic">·</span>
          )}
        </div>

        <div className="pt-1">
          {group.is_member ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleOpen}
            >
              {t("open")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                t("join")
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
