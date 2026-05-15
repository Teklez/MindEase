"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import { useGroups } from "@/hooks/useGroups";
import { cn } from "@/lib/utils";
import type { GroupListItem } from "@/lib/types";

type Tab = "my" | "discover";

interface Props {
  /** When the user picks a group from the list, close any open mobile sheet. */
  onNavigate?: () => void;
}

/**
 * Persistent left sidebar that powers the unified groups experience:
 * search + my/discover tabs + category filter + list + create button.
 *
 * The active group is highlighted based on the URL (`/groups/[groupId]`).
 * Selecting another group navigates within the shared layout — the sidebar
 * itself never unmounts.
 */
export function GroupsSidebar({ onNavigate }: Props) {
  const t = useTranslations("groups");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ groupId?: string }>();
  const activeGroupId = params?.groupId ?? null;

  const [tab, setTab] = useState<Tab>("my");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { groups, categories, isLoading } = useGroups({
    category: activeCategory ?? undefined,
    my_groups: tab === "my",
    search: debouncedSearch || undefined,
  });

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of groups) map[g.category] = (map[g.category] ?? 0) + 1;
    return map;
  }, [groups]);

  const handlePick = (g: GroupListItem) => {
    if (g.group_id === activeGroupId) {
      onNavigate?.();
      return;
    }
    router.push(`/groups/${g.group_id}`);
    onNavigate?.();
  };

  const handleCreated = (groupId: string) => {
    router.push(`/groups/${groupId}`);
    onNavigate?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <Link
            href="/groups"
            className="font-serif text-[17px] font-medium tracking-tight text-foreground"
            onClick={() => onNavigate?.()}
          >
            {t("title")}
          </Link>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label={t("createGroup")}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-border px-3 pt-2.5">
        <div className="flex gap-1">
          {(["my", "discover"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "flex-1 border-b-2 px-2 pb-2 pt-1 text-[12.5px] font-medium transition-colors",
                tab === value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={tab === value}
            >
              {value === "my" ? t("myGroups") : t("discover")}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-border px-3 py-2.5">
        <label className="flex h-8 items-center gap-2 rounded-sm border border-border bg-secondary/50 px-2 transition-colors focus-within:border-primary focus-within:bg-background">
          <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="shrink-0 border-b border-border px-3 py-2">
          <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryChip
              label={locale === "am" ? "ሁሉም" : "All"}
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
            />
            {categories.map((c) => {
              const active = activeCategory === c.value;
              const label = locale === "am" && c.label_am ? c.label_am : c.label;
              return (
                <CategoryChip
                  key={c.value}
                  label={
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden>{c.icon}</span>
                      <span>{label}</span>
                    </span>
                  }
                  count={countByCategory[c.value] ?? undefined}
                  active={active}
                  activeColor={c.color}
                  onClick={() => setActiveCategory(active ? null : c.value)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5 py-2">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          </div>
        ) : groups.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" strokeWidth={1.5} />
            <p className="font-serif text-[14px] text-foreground">
              {tab === "my" ? t("noMyGroups") : t("noGroups")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="mt-3 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              {t("createGroup")}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-px">
            {groups.map((g) => (
              <GroupRow
                key={g.group_id}
                group={g}
                active={g.group_id === activeGroupId}
                isAm={locale === "am"}
                onClick={() => handlePick(g)}
              />
            ))}
          </ul>
        )}
      </div>

      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        onCreated={handleCreated}
      />
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  activeColor,
  onClick,
}: {
  label: React.ReactNode;
  count?: number;
  active: boolean;
  activeColor?: string;
  onClick: () => void;
}) {
  const style: React.CSSProperties | undefined =
    active && activeColor
      ? { backgroundColor: activeColor, borderColor: activeColor, color: "white" }
      : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-colors",
        active && !activeColor && "border-primary bg-primary text-primary-foreground",
        !active && "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "rounded-full px-1 text-[9.5px] font-medium",
            active ? "bg-white/25 text-white" : "bg-secondary text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function GroupRow({
  group,
  active,
  isAm,
  onClick,
}: {
  group: GroupListItem;
  active: boolean;
  isAm: boolean;
  onClick: () => void;
}) {
  const cover = group.cover_color ?? "#4F7263";
  const name = isAm && group.name_am ? group.name_am : group.name;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
          active
            ? "bg-primary-soft text-primary-deep"
            : "text-foreground/85 hover:bg-secondary/60",
        )}
        aria-current={active ? "page" : undefined}
      >
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[15px]"
          style={{
            backgroundColor: `color-mix(in oklab, ${cover} 22%, transparent)`,
          }}
          aria-hidden
        >
          {group.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
            <span className="truncate">{name}</span>
            {group.has_unread && !active && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            )}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {group.member_count} {group.member_count === 1 ? "member" : "members"}
            {!group.is_member && " · Join to chat"}
          </p>
        </div>
      </button>
    </li>
  );
}
