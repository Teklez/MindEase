"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Headphones, Heart, Loader2, Sparkles, Video } from "lucide-react";
import { ResourceCard } from "@/components/resources/ResourceCard";
import { RecommendationCard } from "@/components/resources/RecommendationCard";
import { VideoModal } from "@/components/resources/VideoModal";
import { Button } from "@/components/ui/button";
import { useResources } from "@/hooks/useResources";
import { cn } from "@/lib/utils";
import type { ResourceResponse, ResourceType } from "@/lib/types";

const CATEGORY_KEYS = [
  "anxiety",
  "depression",
  "stress",
  "mindfulness",
  "sleep",
  "self_esteem",
] as const;

const TYPE_OPTIONS: Array<{ id: ResourceType; icon: typeof FileText; tKey: "articles" | "videos" | "audio" }> = [
  { id: "article", icon: FileText, tKey: "articles" },
  { id: "video", icon: Video, tKey: "videos" },
  { id: "audio", icon: Headphones, tKey: "audio" },
];

export default function ResourcesPage() {
  const t = useTranslations("resources");
  const locale = useLocale();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ResourceType | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [modalResource, setModalResource] = useState<ResourceResponse | null>(null);

  const {
    resources,
    categories,
    recommendations,
    isLoading,
    isLoadingRecommendations,
    toggleFavorite,
    trackView,
  } = useResources({
    category: activeCategory ?? undefined,
    type: activeType ?? undefined,
    favorites_only: favoritesOnly,
  });

  const totalCount = useMemo(
    () => categories.reduce((sum, c) => sum + c.count, 0),
    [categories],
  );
  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of categories) map[c.name] = c.count;
    return map;
  }, [categories]);

  const handleView = (resource: ResourceResponse) => {
    trackView(resource.resource_id);
    if (resource.resource_type === "article") {
      if (typeof window !== "undefined") {
        window.open(resource.url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    setModalResource(resource);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("title")}
        </p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
      </header>

      {(isLoadingRecommendations || recommendations.length > 0) && (
        <section className="mb-10 rounded-xl border border-primary/20 bg-primary/[0.03] p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
            <h2 className="font-serif text-lg text-foreground">{t("recommended")}</h2>
          </div>
          {isLoadingRecommendations ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              <span>{t("title")}…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.resource.resource_id}
                  recommendation={rec}
                  onFavorite={toggleFavorite}
                  onView={handleView}
                  lang={locale}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="mb-6 space-y-3">
        <div className="flex items-start gap-2 overflow-x-auto pb-1">
          <FilterPill
            label={t("all")}
            count={totalCount}
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {CATEGORY_KEYS.map((key) => (
            <FilterPill
              key={key}
              label={t(`categories.${key}`)}
              count={countByCategory[key] ?? 0}
              active={activeCategory === key}
              onClick={() => setActiveCategory(activeCategory === key ? null : key)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label={t("all")}
              active={activeType === null}
              compact
              onClick={() => setActiveType(null)}
            />
            {TYPE_OPTIONS.map(({ id, icon: Icon, tKey }) => (
              <FilterPill
                key={id}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {t(tKey)}
                  </span>
                }
                active={activeType === id}
                compact
                onClick={() => setActiveType(activeType === id ? null : id)}
              />
            ))}
          </div>

          <Button
            type="button"
            variant={favoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFavoritesOnly((v) => !v)}
            className="gap-1.5"
          >
            <Heart
              className={cn(
                "h-4 w-4",
                favoritesOnly && "fill-current",
              )}
              strokeWidth={1.75}
            />
            {t("favorites")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[340px] animate-pulse rounded-lg border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <p className="font-serif text-lg text-foreground">{t("noResources")}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource, idx) => (
            <div
              key={resource.resource_id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
            >
              <ResourceCard
                resource={resource}
                onFavorite={toggleFavorite}
                onView={handleView}
                lang={locale}
              />
            </div>
          ))}
        </div>
      )}

      <VideoModal
        resource={modalResource}
        open={modalResource !== null}
        onOpenChange={(open) => {
          if (!open) setModalResource(null);
        }}
        onFavorite={toggleFavorite}
        lang={locale}
      />
    </div>
  );
}

interface PillProps {
  label: React.ReactNode;
  active: boolean;
  count?: number;
  compact?: boolean;
  onClick: () => void;
}

function FilterPill({ label, active, count, compact, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border transition-colors",
        compact ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[12.5px]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="font-medium">{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "rounded-full px-1.5 text-[10.5px] font-medium",
            active
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
