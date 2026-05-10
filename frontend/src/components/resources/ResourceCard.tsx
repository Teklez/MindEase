"use client";

import { useState } from "react";
import {
  BookOpen,
  Clock,
  FileText,
  Headphones,
  Heart,
  Play,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ResourceResponse } from "@/lib/types";

interface Props {
  resource: ResourceResponse;
  onFavorite: (resourceId: string) => void;
  onView: (resource: ResourceResponse) => void;
  lang: string;
}

function youtubeIdFromEmbed(url: string): string | null {
  const match = url.match(/youtube\.com\/embed\/([\w-]+)/);
  return match ? match[1] : null;
}

const typeStyles = {
  article: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/30 dark:text-blue-200",
  video: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-200",
  audio: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/40 dark:bg-purple-900/30 dark:text-purple-200",
} as const;

const TypeIcon = {
  article: FileText,
  video: Video,
  audio: Headphones,
} as const;

const typeLabel = {
  article: "Article",
  video: "Video",
  audio: "Audio",
} as const;

const durationIcon = {
  article: BookOpen,
  video: Clock,
  audio: Headphones,
} as const;

export function ResourceCard({ resource, onFavorite, onView, lang }: Props) {
  const [heartPulse, setHeartPulse] = useState(false);
  const Icon = TypeIcon[resource.resource_type];
  const DurationIcon = durationIcon[resource.resource_type];

  const title = lang === "am" && resource.title_am ? resource.title_am : resource.title;
  const description =
    lang === "am" && resource.description_am
      ? resource.description_am
      : resource.description;

  // Resolve thumbnail: prefer explicit thumbnail_url; for videos with no thumb,
  // derive from YouTube id.
  let thumbnail: string | null = resource.thumbnail_url;
  if (!thumbnail && resource.resource_type !== "article") {
    const ytId = youtubeIdFromEmbed(resource.url);
    if (ytId) thumbnail = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
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
        "group flex h-full cursor-pointer flex-col overflow-hidden p-0 transition-all",
        "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden",
          !thumbnail && "bg-gradient-to-br",
          !thumbnail && resource.resource_type === "audio" && "from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-950/40",
          !thumbnail && resource.resource_type === "article" && "from-muted to-muted/50",
        )}
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon
              className={cn(
                "h-12 w-12",
                resource.resource_type === "audio"
                  ? "text-purple-500/70"
                  : "text-muted-foreground/50",
              )}
              strokeWidth={1.25}
            />
          </div>
        )}

        {(resource.resource_type === "video" || resource.resource_type === "audio") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur transition-transform",
                "group-hover:scale-110",
              )}
            >
              <Play className="h-6 w-6 translate-x-0.5 text-foreground" strokeWidth={2} fill="currentColor" />
            </div>
          </div>
        )}

        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              typeStyles[resource.resource_type],
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={2} />
            {typeLabel[resource.resource_type]}
          </span>
        </div>

        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-label={resource.is_favorite ? "Remove from favorites" : "Add to favorites"}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
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
        <h3 className="line-clamp-2 font-serif text-[17px] leading-snug text-foreground">
          {title}
        </h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            {resource.duration && (
              <>
                <DurationIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {resource.duration}
              </>
            )}
          </span>
          <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10.5px] capitalize text-muted-foreground">
            {resource.category.replace("_", " ")}
          </span>
        </div>
      </div>
    </Card>
  );
}
