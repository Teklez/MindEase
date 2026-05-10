"use client";

import { useState } from "react";
import { Headphones, Heart, Play, Sparkles, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ResourceRecommendation, ResourceResponse } from "@/lib/types";

interface Props {
  recommendation: ResourceRecommendation;
  onFavorite: (resourceId: string) => void;
  onView: (resource: ResourceResponse) => void;
  lang: string;
}

function youtubeIdFromEmbed(url: string): string | null {
  const match = url.match(/youtube\.com\/embed\/([\w-]+)/);
  return match ? match[1] : null;
}

export function RecommendationCard({ recommendation, onFavorite, onView, lang }: Props) {
  const { resource, reason, reason_am } = recommendation;
  const [heartPulse, setHeartPulse] = useState(false);

  const title = lang === "am" && resource.title_am ? resource.title_am : resource.title;
  const reasonText = lang === "am" && reason_am ? reason_am : reason;

  let thumbnail: string | null = resource.thumbnail_url;
  if (!thumbnail && resource.resource_type !== "article") {
    const ytId = youtubeIdFromEmbed(resource.url);
    if (ytId) thumbnail = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
  }

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHeartPulse(true);
    setTimeout(() => setHeartPulse(false), 250);
    onFavorite(resource.resource_id);
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onView(resource)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(resource);
        }
      }}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden p-0 transition-all",
        "border-primary/40 bg-primary/[0.04] shadow-sm",
        "hover:-translate-y-0.5 hover:border-primary hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="relative aspect-[16/8] w-full overflow-hidden bg-muted">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
            {resource.resource_type === "audio" ? (
              <Headphones className="h-10 w-10 text-primary/60" strokeWidth={1.25} />
            ) : (
              <Video className="h-10 w-10 text-primary/60" strokeWidth={1.25} />
            )}
          </div>
        )}

        {(resource.resource_type === "video" || resource.resource_type === "audio") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/15">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
              <Play className="h-5 w-5 translate-x-0.5 text-foreground" strokeWidth={2} fill="currentColor" />
            </div>
          </div>
        )}

        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
          <Sparkles className="h-3 w-3" strokeWidth={2.25} />
          For you
        </span>

        <button
          type="button"
          onClick={handleFavorite}
          aria-label={resource.is_favorite ? "Remove from favorites" : "Add to favorites"}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 backdrop-blur transition-colors hover:bg-background"
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-all",
              resource.is_favorite ? "fill-red-500 text-red-500" : "text-muted-foreground",
              heartPulse && "scale-125",
            )}
            strokeWidth={1.75}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-serif text-[16px] leading-snug text-foreground">
          {title}
        </h3>
        <p className="line-clamp-2 text-[12.5px] italic leading-relaxed text-primary/85">
          {reasonText}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
          <span className="capitalize">{resource.category.replace("_", " ")}</span>
          {resource.duration && <span>{resource.duration}</span>}
        </div>
      </div>
    </Card>
  );
}
