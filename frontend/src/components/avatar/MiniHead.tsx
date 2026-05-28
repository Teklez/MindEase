"use client";

import { useEffect, useRef, useState } from "react";
import { TalkingHead } from "@met4citizen/talkinghead";
import { LipsyncEn } from "@met4citizen/talkinghead/modules/lipsync-en.mjs";
import { cn } from "@/lib/utils";
import type { AvatarOption } from "./types";

// Render an in-card mini TalkingHead that loads the avatar's GLB, fades in
// over the resting thumbnail, speaks the persona's intro with lipsync, and
// notifies the parent via `onEnd` so the picker can swap back to the static
// resting state. Designed to be mounted on a play click and unmounted on
// stop / playback end / unmount of the picker.
export function MiniHead({
  avatar,
  tts,
  onEnd,
}: {
  avatar: AvatarOption;
  tts: { pcm: ArrayBuffer; sampleRate: number };
  onEnd: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !avatar.url) return;
    let cancelled = false;
    let endTimer: ReturnType<typeof setTimeout> | null = null;

    const head = new TalkingHead(containerRef.current, {
      ttsEndpoint: "",
      lipsyncModules: [],
      lipsyncLang: "en",
      cameraView: "head",
      modelFPS: 30,
      avatarMood: "neutral",
      avatarIdleEyeContact: 0.5,
      avatarSpeakingEyeContact: 0.8,
    });
    head.lipsync.en = new LipsyncEn();

    (async () => {
      try {
        await head.showAvatar({
          url: avatar.url!,
          body: avatar.body,
          lipsyncLang: "en",
          avatarMood: "neutral",
          ...(avatar.rig?.retarget ? { retarget: avatar.rig.retarget } : {}),
          ...(avatar.rig?.baseline ? { baseline: avatar.rig.baseline } : {}),
        });
        if (cancelled) return;

        // Resume the audio context from within this user-gesture-initiated
        // effect — Chrome's autoplay policy otherwise leaves it suspended.
        const h = head as unknown as {
          audioCtx?: { state: string; resume: () => Promise<void> };
        };
        if (h.audioCtx?.state === "suspended") {
          await h.audioCtx.resume().catch(() => {});
        }

        // Estimate word timings from intro text + PCM duration. TalkingHead's
        // English lipsync engine maps these to visemes.
        const int16Len = tts.pcm.byteLength / 2;
        const durationMs = (int16Len / tts.sampleRate) * 1000;
        const words = avatar.intro.trim().split(/\s+/).filter(Boolean);
        const msPerWord = words.length ? durationMs / words.length : durationMs;

        setVisible(true); // fade in
        head.speakAudio({
          audio: [tts.pcm],
          words,
          wtimes: words.map((_, i) => i * msPerWord),
          wdurations: words.map(() => msPerWord),
        });

        // Schedule notify-end slightly after the audio finishes so the parent
        // doesn't unmount us mid-viseme.
        endTimer = setTimeout(() => {
          if (!cancelled) onEnd();
        }, durationMs + 350);
      } catch (err) {
        console.error("MiniHead failed:", err);
        if (!cancelled) onEnd();
      }
    })();

    return () => {
      cancelled = true;
      if (endTimer) clearTimeout(endTimer);
      try {
        (head as unknown as { dispose?: () => void }).dispose?.();
      } catch {
        try {
          (head as unknown as { stop?: () => void }).stop?.();
        } catch {
          /* ignore */
        }
      }
      if (containerRef.current) {
        containerRef.current.querySelectorAll("canvas").forEach((c) => c.remove());
      }
    };
    // intentionally not depending on onEnd / tts — those don't change identity
    // within a single play session (parent stops us by unmounting)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar.id]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
