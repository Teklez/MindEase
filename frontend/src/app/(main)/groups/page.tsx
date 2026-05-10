"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Search, Users } from "lucide-react";
import { GroupCard } from "@/components/groups/GroupCard";
import { CreateGroupModal } from "@/components/groups/CreateGroupModal";
import { Button } from "@/components/ui/button";
import { useGroups } from "@/hooks/useGroups";
import { cn } from "@/lib/utils";

type Tab = "discover" | "my";

export default function GroupsPage() {
  const t = useTranslations("groups");
  const locale = useLocale();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("discover");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { groups, categories, isLoading, joinGroup } = useGroups({
    category: activeCategory ?? undefined,
    my_groups: tab === "my",
    search: debouncedSearch || undefined,
  });

  const totalCount = groups.length;
  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of groups) map[g.category] = (map[g.category] ?? 0) + 1;
    return map;
  }, [groups]);

  const handleOpen = (groupId: string) => {
    router.push(`/groups/${groupId}`);
  };

  const handleCreated = (groupId: string) => {
    router.push(`/groups/${groupId}`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {t("title")}
          </p>
          <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground md:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5 self-start md:self-auto"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          {t("createGroup")}
        </Button>
      </header>

      <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted/40 p-1">
        {(["discover", "my"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              tab === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={tab === value}
          >
            {value === "discover" ? t("discover") : t("myGroups")}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        <CategoryPill
          label={locale === "am" ? "ሁሉም" : "All"}
          count={totalCount}
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {categories.map((c) => {
          const active = activeCategory === c.value;
          const label = locale === "am" && c.label_am ? c.label_am : c.label;
          return (
            <CategoryPill
              key={c.value}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden>{c.icon}</span>
                  {label}
                </span>
              }
              count={countByCategory[c.value] ?? 0}
              active={active}
              activeColor={c.color}
              onClick={() =>
                setActiveCategory(active ? null : c.value)
              }
            />
          );
        })}
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[220px] animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <Users
            className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60"
            strokeWidth={1.5}
          />
          <p className="font-serif text-lg text-foreground">
            {tab === "my" ? t("noMyGroups") : t("noGroups")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("createFirst")}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="mt-5 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            {t("createGroup")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, idx) => (
            <div
              key={group.group_id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
            >
              <GroupCard
                group={group}
                lang={locale}
                onJoin={joinGroup}
                onOpen={handleOpen}
              />
            </div>
          ))}
        </div>
      )}

      <CreateGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        onCreated={handleCreated}
      />
    </div>
  );
}

interface PillProps {
  label: React.ReactNode;
  count?: number;
  active: boolean;
  activeColor?: string;
  onClick: () => void;
}

function CategoryPill({ label, count, active, activeColor, onClick }: PillProps) {
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
        active && !activeColor
          ? "border-primary bg-primary text-primary-foreground"
          : !active &&
              "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span>{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10.5px] font-medium",
            active
              ? "bg-white/25 text-white"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
