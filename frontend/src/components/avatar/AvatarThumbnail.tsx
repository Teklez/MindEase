"use client";

import { useEffect, useRef, useState } from "react";
import { TalkingHead } from "@met4citizen/talkinghead";
import { LipsyncEn } from "@met4citizen/talkinghead/modules/lipsync-en.mjs";
import type { AvatarOption } from "./types";

const CACHE_VERSION = "v2";
const CACHE_PREFIX = `avatar-thumb:${CACHE_VERSION}:`;

const cacheKey = (url: string) => `${CACHE_PREFIX}${url}`;

const getCached = (url: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(cacheKey(url));
  } catch {
    return null;
  }
};
const setCached = (url: string, dataUrl: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(url), dataUrl);
  } catch {
    /* quota exceeded — silently skip caching */
  }
};

// Serialize renders so multiple thumbnails don't fight for GPU contexts and
// overwhelm slower devices. Cards still get their thumbnails one-by-one over
// a few seconds on first load; on subsequent loads it's all cached.
let renderQueue: Promise<unknown> = Promise.resolve();

type ActiveHead = { dispose?: () => void; stop?: () => void };

export function AvatarThumbnail({
  avatar,
  disabled = false,
}: {
  avatar: AvatarOption;
  // When true, skip rendering — used while MiniHead is active so we don't
  // run two TalkingHead instances against the same card simultaneously.
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(() =>
    avatar.url ? getCached(avatar.url) : null,
  );

  useEffect(() => {
    if (!avatar.url || dataUrl || disabled) return;
    let cancelled = false;
    let activeHead: ActiveHead | null = null;

    renderQueue = renderQueue.then(async () => {
      if (cancelled || !containerRef.current || !avatar.url) return;
      // Re-check cache: another instance may have rendered the same avatar
      // while we were queued.
      const cached = getCached(avatar.url);
      if (cached) {
        if (!cancelled) setDataUrl(cached);
        return;
      }

      const head = new TalkingHead(containerRef.current, {
        ttsEndpoint: "",
        lipsyncModules: [],
        lipsyncLang: "en",
        cameraView: "head",
        modelFPS: 30,
        avatarMood: "neutral",
        avatarIdleEyeContact: 0.5,
      });
      activeHead = head as unknown as ActiveHead;
      (head as unknown as { lipsync: { en: LipsyncEn } }).lipsync.en = new LipsyncEn();

      try {
        await head.showAvatar({
          url: avatar.url,
          body: avatar.body,
          lipsyncLang: "en",
          avatarMood: "neutral",
          ...(avatar.rig?.retarget ? { retarget: avatar.rig.retarget } : {}),
          ...(avatar.rig?.baseline ? { baseline: avatar.rig.baseline } : {}),
        });
        if (cancelled) return;

        // Let idle animations settle so the snapshot isn't caught mid-blink
        // or pre-pose. ~600ms gives the avatar time to reach its rest pose.
        await new Promise((r) => setTimeout(r, 600));
        if (cancelled) return;

        const canvas = containerRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) throw new Error("Thumbnail render: no canvas");

        // three.js's default WebGLRenderer is created with preserveDrawingBuffer
        // false — meaning the canvas buffer is wiped after each frame. Reading
        // pixels via toDataURL after even a setTimeout yields a blank image.
        // Workaround: reach into TalkingHead's renderer/scene/camera and force
        // a fresh render right before reading, all in the same sync tick so the
        // browser hasn't had a chance to clear the buffer yet.
        const internal = head as unknown as {
          renderer?: { render: (scene: unknown, camera: unknown) => void };
          scene?: unknown;
          camera?: unknown;
          cameras?: Record<string, unknown>;
          cameraView?: string;
        };
        const renderer = internal.renderer;
        const scene = internal.scene;
        const camera =
          internal.camera ??
          (internal.cameras && internal.cameraView
            ? internal.cameras[internal.cameraView]
            : undefined);
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }

        const url = canvas.toDataURL("image/png");
        if (url.length < 1000) {
          // ~1KB indicates a blank/empty PNG — render didn't catch anything.
          throw new Error("Thumbnail render: blank canvas");
        }
        setCached(avatar.url, url);
        if (!cancelled) setDataUrl(url);
      } catch (err) {
        console.warn(`Thumbnail render failed for ${avatar.id}:`, err);
      } finally {
        try {
          activeHead?.dispose?.();
        } catch {
          try {
            activeHead?.stop?.();
          } catch {
            /* ignore */
          }
        }
        if (containerRef.current) {
          containerRef.current
            .querySelectorAll("canvas")
            .forEach((c) => c.remove());
        }
        activeHead = null;
      }
    });

    return () => {
      cancelled = true;
      try {
        activeHead?.dispose?.();
      } catch {
        try {
          activeHead?.stop?.();
        } catch {
          /* ignore */
        }
      }
    };
    // intentionally exclude `dataUrl` — we only kick off a render on mount or
    // when avatar/disabled flips, never because the render itself completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar.id, disabled]);

  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt={avatar.name}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  // Empty container while the live render is being driven into it. Once the
  // snapshot is captured (~2–3 s) the component re-renders into the <img>
  // branch above and the canvas is disposed.
  return <div ref={containerRef} className="absolute inset-0" />;
}
