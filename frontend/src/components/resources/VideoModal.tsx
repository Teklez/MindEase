"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ResourceResponse } from "@/lib/types";

interface Props {
  resource: ResourceResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFavorite: (resourceId: string) => void;
  lang: string;
}

export function VideoModal({ resource, open, onOpenChange, onFavorite, lang }: Props) {
  if (!resource) return null;

  const title = lang === "am" && resource.title_am ? resource.title_am : resource.title;
  const description =
    lang === "am" && resource.description_am
      ? resource.description_am
      : resource.description;
  const isAudio = resource.resource_type === "audio";
  const embedUrl = `${resource.url}${resource.url.includes("?") ? "&" : "?"}autoplay=1`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-border bg-background p-0">
        <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-black">
          {open && (
            <iframe
              src={embedUrl}
              title={title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
        <div className="space-y-3 px-6 pb-6 pt-4">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl leading-snug text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 capitalize">
                {resource.category.replace("_", " ")}
              </span>
              {resource.duration && <span>{resource.duration}</span>}
              {isAudio && <span aria-hidden>🎧</span>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onFavorite(resource.resource_id)}
              className="gap-1.5"
            >
              <Heart
                className={cn(
                  "h-4 w-4 transition-all",
                  resource.is_favorite
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground",
                )}
                strokeWidth={1.75}
              />
              <span className="text-xs">
                {resource.is_favorite ? "Favorited" : "Favorite"}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
