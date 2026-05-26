"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Pause, Play, Sparkles } from "lucide-react";
import { fetchTTS, type GeminiVoiceId } from "@/lib/gemini-avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AvatarBody, AvatarOption, AvatarRig } from "./types";

// Lazy-load the heavy viewer (TalkingHead + three.js + voice session, ~MB).
// The picker should not pull this in until the user has chosen a companion.
const AvatarViewer = dynamic(
  () => import("./AvatarViewer").then((m) => m.AvatarViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    ),
  },
);

// Warm the viewer chunk (and its three.js / TalkingHead deps) on user intent so
// the click-to-load latency disappears.
let viewerPrefetched = false;
function prefetchViewer() {
  if (viewerPrefetched) return;
  viewerPrefetched = true;
  void import("./AvatarViewer");
}

// MiniHead is the in-card mini TalkingHead used by the picker's play preview.
// Lazy-loaded so the TalkingHead + three.js bundle isn't pulled in on the
// initial picker render — same trick as AvatarViewer above.
const MiniHead = dynamic(() => import("./MiniHead").then((m) => m.MiniHead), {
  ssr: false,
});

// AvatarThumbnail renders a static head-shot of the avatar (cached in
// localStorage) into the card's resting state. First load: lives behind a
// brief live three.js render that captures the snapshot; thereafter, instant.
const AvatarThumbnail = dynamic(
  () => import("./AvatarThumbnail").then((m) => m.AvatarThumbnail),
  { ssr: false },
);

// Persona static metadata. Display name, blurb, and intro are pulled from
// translations so they switch locale (English ↔ Amharic) and use the
// localised Ethiopian persona names.
type PersonaStatic = {
  id: string;
  url: string | null;
  body: AvatarBody;
  geminiVoice: GeminiVoiceId;
  rig?: AvatarRig;
};

// Verified from met4citizen/TalkingHead siteconfig.js — Avaturn skeletons
// sit slightly hunched without these nudges. RPM (brunette.glb) needs no rig.
const AVATURN_RIG: AvatarRig = {
  retarget: {
    Hips: { y: 0.03 },
    Spine: { y: 0.02 },
    Spine1: { y: 0.02, z: 0.01 },
    Spine2: { y: 0.02, z: 0.01 },
    Neck: { z: 0.02, y: 0.01 },
    Head: { z: 0.02 },
    LeftShoulder: { rx: -0.5 },
    RightShoulder: { rx: -0.5 },
    scaleToHipsLevel: 1.0,
  },
  baseline: {
    headRotateX: -0.05,
    eyeBlinkLeft: 0.15,
    eyeBlinkRight: 0.15,
  },
};

const PERSONAS: PersonaStatic[] = [
  { id: "serenity", url: "/avatars/brunette.glb", body: "F", geminiVoice: "Kore" },
  { id: "maya", url: "/avatars/avatar-2026-05-26T19-00-59-230Z.glb", body: "M", geminiVoice: "Fenrir", rig: AVATURN_RIG },
  { id: "alex", url: "/avatars/bereket.glb", body: "M", geminiVoice: "Puck", rig: AVATURN_RIG },
  { id: "ashenafi", url: "/avatars/ashenafi.glb", body: "M", geminiVoice: "Orus", rig: AVATURN_RIG },
  { id: "bedru", url: "/avatars/bedru.glb", body: "M", geminiVoice: "Algenib", rig: AVATURN_RIG },
  // Sora and Kai are coming-soon — `url: null` makes the card non-clickable
  // and disables the play preview until they get their own T2 GLBs. Kept at
  // the end of the list so the picker shows real personas first.
  { id: "sora", url: null, body: "F", geminiVoice: "Aoede" },
  { id: "kai", url: null, body: "M", geminiVoice: "Charon" },
];

function useLocalizedAvatars(): AvatarOption[] {
  const t = useTranslations("avatar.personas");
  return useMemo(
    () =>
      PERSONAS.map((p) => ({
        ...p,
        name: t(`${p.id}.name`),
        blurb: t(`${p.id}.blurb`),
        intro: t(`${p.id}.intro`),
      })),
    [t],
  );
}

function AvatarPicker({
  avatars,
  onSelect,
}: {
  avatars: AvatarOption[];
  onSelect: (a: AvatarOption) => void;
}) {
  const t = useTranslations("avatar.picker");
  const locale = useLocale();
  // The card whose preview is currently mounted (loading or speaking).
  const [playingId, setPlayingId] = useState<string | null>(null);
  // The TTS payload handed off to MiniHead once we've fetched it.
  const [playingTTS, setPlayingTTS] = useState<{
    pcm: ArrayBuffer;
    sampleRate: number;
  } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Cache TTS audio per (avatar, locale) so re-clicking doesn't re-fetch AND a
  // locale switch doesn't replay an English intro under the Amharic UI.
  const cacheRef = useRef<Map<string, { pcm: ArrayBuffer; sampleRate: number }>>(new Map());
  // In-flight TTS requests keyed the same way as the cache, so hover-prefetch
  // and an immediate click on the same card share one fetch instead of racing.
  const inflightRef = useRef<Map<string, Promise<{ pcm: ArrayBuffer; sampleRate: number }>>>(
    new Map(),
  );

  const cacheKey = (id: string) => `${id}:${locale}`;

  function ensureTTS(a: AvatarOption): Promise<{ pcm: ArrayBuffer; sampleRate: number }> {
    const key = cacheKey(a.id);
    const cached = cacheRef.current.get(key);
    if (cached) return Promise.resolve(cached);
    const inflight = inflightRef.current.get(key);
    if (inflight) return inflight;
    const promise = fetchTTS(a.intro, a.geminiVoice)
      .then((tts) => {
        const audio = { pcm: tts.pcm, sampleRate: tts.sampleRate };
        cacheRef.current.set(key, audio);
        inflightRef.current.delete(key);
        return audio;
      })
      .catch((err) => {
        inflightRef.current.delete(key);
        throw err;
      });
    inflightRef.current.set(key, promise);
    return promise;
  }

  // Hover/focus warms the TTS in the background so click→audio is instant.
  function prefetchPreview(a: AvatarOption) {
    if (!a.url) return;
    void ensureTTS(a).catch(() => {
      /* silent — surface only when the user actually clicks play */
    });
  }

  function stopPreview() {
    setPlayingId(null);
    setPlayingTTS(null);
  }

  useEffect(() => {
    return () => stopPreview();
  }, []);

  async function playPreview(a: AvatarOption) {
    setPreviewError(null);
    if (!a.url) return;
    // Clicking the currently-playing avatar = toggle off.
    if (playingId === a.id) {
      stopPreview();
      return;
    }
    setPlayingId(a.id);
    setPlayingTTS(null); // clears any stale audio while we fetch the new one

    try {
      const audio = await ensureTTS(a);
      // If the user moved on while we were fetching, drop this result.
      setPlayingId((cur) => {
        if (cur === a.id) setPlayingTTS(audio);
        return cur;
      });
    } catch (err) {
      console.error("Preview failed:", err);
      setPreviewError(err instanceof Error ? err.message : String(err));
      setPlayingId(null);
      setPlayingTTS(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground md:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
        {previewError && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {t("previewUnavailable", { message: previewError })}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {avatars.map((a) => {
          const available = !!a.url;
          const playing = playingId === a.id;
          const onIntent = available
            ? () => {
                prefetchViewer();
                prefetchPreview(a);
              }
            : undefined;
          return (
            <Card
              key={a.id}
              className={cn(
                "group relative flex flex-col overflow-hidden p-5 transition-all",
                available
                  ? "cursor-pointer hover:border-primary hover:shadow-md"
                  : "cursor-not-allowed opacity-80",
                playing && "border-primary shadow-md",
              )}
              onClick={() => available && onSelect(a)}
              onMouseEnter={onIntent}
              onFocus={onIntent}
              role={available ? "button" : undefined}
              tabIndex={available ? 0 : -1}
              onKeyDown={(e) => {
                if (available && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(a);
                }
              }}
            >
              <div className="relative mb-4 flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-muted to-muted/40">
                {available ? (
                  <AvatarThumbnail avatar={a} disabled={playing} />
                ) : (
                  <Sparkles
                    className="h-10 w-10 text-muted-foreground/60"
                    strokeWidth={1.25}
                  />
                )}
                {playing && playingTTS && a.url && (
                  <MiniHead
                    avatar={a}
                    tts={playingTTS}
                    onEnd={stopPreview}
                  />
                )}
                {!available && (
                  <span className="absolute right-2 top-2 rounded-md border border-border bg-background/90 px-1.5 py-px text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    {t("comingSoon")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPreview(a);
                  }}
                  disabled={!available}
                  aria-label={
                    playing
                      ? t("stopPreview", { name: a.name })
                      : t("playPreview", { name: a.name })
                  }
                  className={cn(
                    "absolute bottom-2 left-2 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all",
                    playing
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/90 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary",
                    !available && "cursor-not-allowed opacity-50 hover:bg-background/90 hover:text-foreground hover:border-border",
                  )}
                >
                  {playing ? (
                    <Pause className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Play className="h-4 w-4 translate-x-px" strokeWidth={2} />
                  )}
                </button>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-serif text-lg text-foreground">{a.name}</h2>
                {playing && (
                  <span className="text-[10px] uppercase tracking-wider text-primary">
                    {t("speaking")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.blurb}</p>
              <p className="mt-3 border-t border-border pt-3 font-serif text-[13px] italic leading-relaxed text-muted-foreground">
                “{a.intro}”
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function AvatarScene({
  preselectPersonaId,
  continueConversationId,
}: {
  preselectPersonaId?: string;
  continueConversationId?: string | null;
} = {}) {
  const avatars = useLocalizedAvatars();
  const [selectedId, setSelectedId] = useState<string | null>(
    preselectPersonaId ?? null,
  );

  const selected = useMemo(
    () => (selectedId ? avatars.find((a) => a.id === selectedId) ?? null : null),
    [avatars, selectedId],
  );

  // When the picker mounts, kick off a low-priority prefetch of the viewer
  // chunk so it's already cached by the time the user picks an avatar.
  useEffect(() => {
    if (selected) return;
    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    const cic = (window as unknown as {
      cancelIdleCallback?: (h: number) => void;
    }).cancelIdleCallback;
    const trigger = ric
      ? ric(prefetchViewer, { timeout: 2000 })
      : window.setTimeout(prefetchViewer, 1500);
    return () => {
      if (ric) {
        cic?.(trigger);
      } else {
        window.clearTimeout(trigger);
      }
    };
  }, [selected]);

  if (!selected) return <AvatarPicker avatars={avatars} onSelect={(a) => setSelectedId(a.id)} />;
  return (
    <AvatarViewer
      avatar={selected}
      onBack={() => setSelectedId(null)}
      continueConversationId={continueConversationId ?? null}
    />
  );
}
