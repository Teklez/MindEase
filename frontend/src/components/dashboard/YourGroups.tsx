"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Users } from "lucide-react";
import { listGroups } from "@/lib/api";
import type { GroupListItem } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 3;

export default function YourGroups() {
  const t = useTranslations("groups");
  const tDash = useTranslations("dashboard");
  const locale = useLocale();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listGroups({ my_groups: true }).then((res) => {
      if (cancelled) return;
      if (res.ok) setGroups(res.data.slice(0, MAX_SHOWN));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide the section if the user isn't in any groups — the empty state on
  // /groups already handles discovery, no need to clutter the dashboard.
  if (loading) return null;
  if (groups.length === 0) return null;

  const isAm = locale === "am";

  return (
    <section
      aria-labelledby="your-groups-heading"
      className="rounded-2xl border border-border bg-card p-6 shadow-soft-sm"
    >
      <header className="flex items-end justify-between">
        <div>
          <h2
            id="your-groups-heading"
            className="font-serif text-xl tracking-tight text-foreground"
          >
            {t("myGroups")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/groups"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {tDash("viewAll")}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      </header>

      <ul className="mt-5 grid gap-3 md:grid-cols-3">
        {groups.map((g) => {
          const name = isAm && g.name_am ? g.name_am : g.name;
          const coverColor = g.cover_color ?? "#4A90A4";
          return (
            <li key={g.group_id}>
              <Link
                href={`/groups/${g.group_id}`}
                className={cn(
                  "group relative flex h-full flex-col rounded-xl border bg-background p-4 transition-all",
                  "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft",
                  g.has_unread ? "border-primary/40" : "border-border",
                )}
              >
                {g.has_unread && (
                  <span
                    className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary"
                    aria-label="unread"
                  />
                )}
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${coverColor}1A` }}
                    aria-hidden
                  >
                    {g.icon}
                  </span>
                  <h3 className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {name}
                  </h3>
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Users className="h-3 w-3" strokeWidth={1.75} />
                  {t("members", { count: g.member_count })}
                </p>
                <p className="mt-auto pt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {g.last_activity ? relativeTime(g.last_activity) : "—"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
