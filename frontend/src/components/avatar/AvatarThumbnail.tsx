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

// Derive the precomputed thumbnail path from an avatar's .glb URL.
// e.g. /avatars/bereket.glb -> /avatars/bereket.webp
const staticThumbUrl = (glbUrl: string): string =>
  glbUrl.replace(/\.glb($|\?)/, ".webp$1");

// Module-level cache: once we know a static thumb exists (or doesn't), don't
// re-probe it on every mount. Maps thumb URL -> "ok" | "missing".
const staticThumbProbe = new Map<string, "ok" | "missing">();

function probeStaticThumb(url: string): Promise<boolean> {
  const cached = staticThumbProbe.get(url);
  if (cached) return Promise.resolve(cached === "ok");
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      staticThumbProbe.set(url, "ok");
      resolve(true);
    };
    img.onerror = () => {
      staticThumbProbe.set(url, "missing");
      resolve(false);
    };
    img.src = url;
  });
}

// Limit concurrent GPU snapshot renders. Strict serial (=1) makes a cold load
// feel like forever; unlimited fights for GPU contexts on weaker devices.
// Two-at-a-time is the sweet spot empirically.
const RENDER_CONCURRENCY = 2;
let activeRenders = 0;
const renderWaiters: Array<() => void> = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenders < RENDER_CONCURRENCY) {
    activeRenders++;
    return;
  }
  await new Promise<void>((resolve) => renderWaiters.push(resolve));
  activeRenders++;
}
function releaseRenderSlot(): void {
  activeRenders--;
  const next = renderWaiters.shift();
  if (next) next();
}

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
  const [staticThumb, setStaticThumb] = useState<string | null>(() => {
    if (!avatar.url) return null;
    const url = staticThumbUrl(avatar.url);
    // Synchronously hand back known-good static thumbs on remount.
    return staticThumbProbe.get(url) === "ok" ? url : null;
  });

  useEffect(() => {
    if (!avatar.url || disabled) return;
    let cancelled = false;
    let activeHead: ActiveHead | null = null;
    let acquired = false;

    (async () => {
      if (!avatar.url) return;

      // Fast path: shipped a static thumbnail next to the .glb? Use it.
      // This is the only path that makes the picker feel instant on first
      // visit — the GPU fallback below is a developer-mode safety net.
      const thumbUrl = staticThumbUrl(avatar.url);
      const hit = await probeStaticThumb(thumbUrl);
      if (cancelled) return;
      if (hit) {
        setStaticThumb(thumbUrl);
        return;
      }

      // No static thumb available — fall through to the legacy live render.
      if (dataUrl) return;
      const cached = getCached(avatar.url);
      if (cached) {
        setDataUrl(cached);
        return;
      }

      await acquireRenderSlot();
      acquired = true;
      if (cancelled || !containerRef.current || !avatar.url) return;
      // Re-check cache: another instance may have rendered the same avatar
      // while we were queued.
      const cached2 = getCached(avatar.url);
      if (cached2) {
        if (!cancelled) setDataUrl(cached2);
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
    })().finally(() => {
      if (acquired) releaseRenderSlot();
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

  if (staticThumb) {
    return (
      <img
        src={staticThumb}
        alt={avatar.name}
        className="h-full w-full object-cover"
        decoding="async"
        loading="eager"
      />
    );
  }

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
