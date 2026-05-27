"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { TalkingHead } from "@met4citizen/talkinghead";
import { LipsyncEn } from "@met4citizen/talkinghead/modules/lipsync-en.mjs";
import { ArrowLeft, Loader2, Mic, Phone, PhoneOff } from "lucide-react";
import { resamplePCM } from "@/lib/gemini-avatar";
import { BackendVoiceSession } from "@/lib/backend-voice";
import { createVoiceConversation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AvatarOption } from "./types";

type AvatarStatus = "loading" | "ready" | "speaking" | "error";

// LipsyncEn only knows Latin letters. To drive visemes for non-English
// languages (Amharic in our case) we transliterate to Latin syllables that
// approximate the phonemes well enough for the mouth shapes — the exact
// sound doesn't matter, only the vowel/consonant pattern that the lipsync
// engine maps to visemes.
//
// Ethiopic Fidel (U+1200–U+137F) is a syllabary: glyphs are laid out in
// blocks of 8 where each row is one consonant and each column is one of
// 7 vowels (the 8th is a labialized variant). So we can compute the
// romanization algorithmically from the code point.
const ETHIOPIC_VOWELS = ["e", "u", "i", "a", "e", "", "o", "wa"];
const ETHIOPIC_CONSONANTS: Record<number, string> = {
  0x1200: "h", 0x1208: "l", 0x1210: "h", 0x1218: "m",
  0x1220: "s", 0x1228: "r", 0x1230: "s", 0x1238: "sh",
  0x1240: "q", 0x1248: "q", 0x1250: "q", 0x1258: "q",
  0x1260: "b", 0x1268: "v", 0x1270: "t", 0x1278: "ch",
  0x1280: "h", 0x1288: "h", 0x1290: "n", 0x1298: "ny",
  0x12a0: "a", 0x12a8: "k", 0x12b0: "k", 0x12b8: "k",
  0x12c0: "k", 0x12c8: "w", 0x12d0: "a", 0x12d8: "z",
  0x12e0: "zh", 0x12e8: "y", 0x12f0: "d", 0x12f8: "j",
  0x1300: "g", 0x1308: "g", 0x1310: "g", 0x1318: "g",
  0x1320: "t", 0x1328: "ch", 0x1330: "p", 0x1338: "s",
  0x1340: "s", 0x1348: "f", 0x1350: "p",
};

function romanizeForLipsync(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x1200 && code <= 0x137f) {
      const block = code - ((code - 0x1200) % 8);
      const consonant = ETHIOPIC_CONSONANTS[block];
      if (consonant === undefined) {
        // Punctuation block (U+1360+) and gaps: emit a space so words split correctly.
        out += " ";
        continue;
      }
      const vowel = ETHIOPIC_VOWELS[(code - 0x1200) % 8];
      out += consonant + vowel;
    } else {
      out += ch;
    }
  }
  return out;
}

// When the transcript has zero Latin-letter tokens (even after romanization)
// we fall back to placeholder syllables proportional to the audio duration
// so the mouth still moves to the speech.
const FALLBACK_WORDS = ["la", "le", "ma", "mo", "na", "no", "ba", "be"];
const LIPSYNC_WORD_RE = /[A-Za-z]/;

function buildLipsyncWords(text: string, durationMs: number) {
  const tokens = romanizeForLipsync(text).trim().split(/\s+/).filter(Boolean);
  const realWords = tokens.filter((w) => LIPSYNC_WORD_RE.test(w));
  if (realWords.length) return realWords;
  // ~400ms per word matches estimateDuration below.
  const count = Math.max(1, Math.round(durationMs / 400));
  return Array.from({ length: count }, (_, i) => FALLBACK_WORDS[i % FALLBACK_WORDS.length]);
}

function estimateWordTimings(text: string, durationMs: number) {
  const words = buildLipsyncWords(text, durationMs);
  const msPerWord = durationMs / words.length;
  return {
    words,
    wtimes: words.map((_, i) => i * msPerWord),
    wdurations: words.map(() => msPerWord),
  };
}

export function AvatarViewer({
  avatar,
  onBack,
  continueConversationId,
}: {
  avatar: AvatarOption;
  onBack: () => void;
  continueConversationId?: string | null;
}) {
  const t = useTranslations("avatar.viewer");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<TalkingHead | null>(null);
  const sessionRef = useRef<BackendVoiceSession | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  // Cumulative time in ms of audio streamed within the current turn — used to
  // align fallback viseme timings across chunks of one continuous utterance.
  const streamOffsetMsRef = useRef(0);
  // True once TalkingHead's AudioWorklet has been initialised. Persists across
  // turns; reset when we call streamStop (e.g. endCall).
  const streamReadyRef = useRef(false);
  // Jitter buffer: collect the first few chunks (~250 ms) before flushing
  // to TalkingHead's worklet so transient network hiccups don't drain the
  // playback queue mid-sentence (audible breaks). After warm-up, chunks
  // are pushed immediately as they arrive.
  const jitterBufferRef = useRef<Array<{ pcm: ArrayBuffer; sampleRate: number }>>([]);
  const jitterPrimedRef = useRef(false);
  const JITTER_PRIME_CHUNKS = 3;


  const [status, setStatus] = useState<AvatarStatus>("loading");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [callStatus, setCallStatus] = useState<
    "idle" | "connecting" | "ready" | "thinking"
  >("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  // Mount + unmount the avatar
  useEffect(() => {
    if (!containerRef.current || !avatar.url) return;
    const head = new TalkingHead(containerRef.current, {
      ttsEndpoint: "",
      // Empty here so the constructor doesn't try to dynamic-import './lipsync-en.mjs'
      // (Next.js bundler can't resolve that relative path at runtime). We register
      // the English processor manually below using the statically-imported class.
      lipsyncModules: [],
      lipsyncLang: "en",
      cameraView: "upper",
      modelFPS: 30,
      avatarMood: "neutral",
      avatarIdleEyeContact: 0.5,
      avatarSpeakingEyeContact: 0.8,
    });
    head.lipsync.en = new LipsyncEn();
    headRef.current = head;
    setStatus("loading");
    setProgress(0);
    setError(null);

    head
      .showAvatar(
        {
          url: avatar.url,
          body: avatar.body,
          lipsyncLang: "en",
          avatarMood: "neutral",
          ...(avatar.rig?.retarget ? { retarget: avatar.rig.retarget } : {}),
          ...(avatar.rig?.baseline ? { baseline: avatar.rig.baseline } : {}),
        },
        (ev: ProgressEvent) => {
          if (ev.lengthComputable && ev.total > 0)
            setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      )
      .then(() => {
        setStatus("ready");
        const h = headRef.current as unknown as {
          morphs?: Array<{
            material?: { needsUpdate: boolean } | Array<{ needsUpdate: boolean }>;
          }>;
        } | null;
        // Nudge the material to recompile so the shader picks up morph
        // attributes. Do NOT call mesh.updateMorphTargets() here: that
        // *reassigns* mesh.morphTargetInfluences to a fresh array, which
        // orphans the references TalkingHead already cached in
        // mtAvatar[mt].ms[i] — meaning all viseme writes from
        // speakAudio's animQueue would silently target a dead buffer.
        h?.morphs?.forEach((m) => {
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((mat) => {
            if (mat) mat.needsUpdate = true;
          });
        });
        window.dispatchEvent(new Event("resize"));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        window.dispatchEvent(new Event("resize"));
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      // Tear the AudioWorklet down before disposing the rest so its postMessage
      // calls don't race with the destroyed AudioContext.
      try {
        (head as unknown as { streamStop?: () => void }).streamStop?.();
      } catch {
        /* ignore */
      }
      streamReadyRef.current = false;
      streamOffsetMsRef.current = 0;
      // Full teardown: stop the rAF, drop the WebGL context, AND remove the
      // canvas from the DOM. With only `head.stop()` (the old code), React
      // strict-mode's mount → unmount → mount cycle leaves the first head's
      // canvas in the container; the second head's canvas is added on top,
      // and morph-target writes on the second instance get visually hidden
      // behind the first's frozen frame.
      try {
        (head as unknown as { dispose?: () => void }).dispose?.();
      } catch {
        // dispose() crashes if showAvatar hasn't finished yet (poseBase
        // isn't populated). Fall back to stop() + manual canvas removal —
        // the goal is just to prevent two canvases from stacking.
        try {
          (head as unknown as { stop?: () => void }).stop?.();
        } catch {
          /* ignore */
        }
      }
      if (containerRef.current) {
        containerRef.current
          .querySelectorAll("canvas")
          .forEach((c) => c.remove());
      }
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      sessionRef.current?.close();
      sessionRef.current = null;
      if (headRef.current === head) headRef.current = null;
    };
  }, [avatar]);

  // Initialise TalkingHead's streaming pipeline. Must be called within a user
  // gesture so the AudioWorklet's AudioContext is allowed to resume.
  const ensureStream = useCallback(async () => {
    const head = headRef.current as unknown as {
      streamStart: (
        opt: { lipsyncType?: string },
        onAudioStart: () => void,
        onAudioEnd: () => void,
      ) => Promise<void>;
    } | null;
    if (!head || streamReadyRef.current) return;
    await head.streamStart(
      { lipsyncType: "words" },
      () => setStatus("speaking"),
      () => setStatus("ready"),
    );
    streamReadyRef.current = true;
  }, []);

  const stopStream = useCallback(() => {
    const head = headRef.current as unknown as {
      streamStop: () => void;
    } | null;
    try {
      head?.streamStop();
    } catch {
      /* ignore */
    }
    streamReadyRef.current = false;
    streamOffsetMsRef.current = 0;
  }, []);

  // Push one Gemini Live chunk into the worklet. The worklet plays consecutive
  // chunks gap-free as long as its queue stays non-empty. We prime the queue
  // with the first few chunks before flushing (jitter cushion), then stream
  // straight through.
  const flushChunkToHead = useCallback((pcm: ArrayBuffer, sampleRate: number) => {
    const head = headRef.current as unknown as {
      audioCtx?: { sampleRate: number };
      streamAudio: (r: {
        audio: Int16Array | ArrayBuffer;
        words?: string[];
        wtimes?: number[];
        wdurations?: number[];
      }) => void;
    } | null;
    if (!head || !streamReadyRef.current) return;
    const targetRate = head.audioCtx?.sampleRate ?? 48000;
    const src16 = new Int16Array(pcm);
    const dst16 = sampleRate === targetRate ? src16 : resamplePCM(src16, sampleRate, targetRate);

    const durationMs = (dst16.length / targetRate) * 1000;
    const startedAt = streamOffsetMsRef.current;
    const timing = estimateWordTimings("", durationMs);
    head.streamAudio({
      audio: dst16,
      words: timing.words,
      wtimes: timing.wtimes.map((t) => startedAt + t),
      wdurations: timing.wdurations,
    });
    streamOffsetMsRef.current = startedAt + durationMs;
  }, []);

  const pushAudioChunk = useCallback(
    (pcm: ArrayBuffer, sampleRate: number) => {
      if (!streamReadyRef.current) return;
      if (jitterPrimedRef.current) {
        flushChunkToHead(pcm, sampleRate);
        return;
      }
      jitterBufferRef.current.push({ pcm, sampleRate });
      if (jitterBufferRef.current.length >= JITTER_PRIME_CHUNKS) {
        jitterPrimedRef.current = true;
        const drained = jitterBufferRef.current;
        jitterBufferRef.current = [];
        for (const c of drained) flushChunkToHead(c.pcm, c.sampleRate);
      }
    },
    [flushChunkToHead],
  );

  const notifyStreamEnd = useCallback(() => {
    // Drain any chunks still parked in the jitter buffer — a very short turn
    // might end before we reach JITTER_PRIME_CHUNKS and otherwise stay silent.
    if (jitterBufferRef.current.length > 0) {
      const drained = jitterBufferRef.current;
      jitterBufferRef.current = [];
      jitterPrimedRef.current = true;
      for (const c of drained) flushChunkToHead(c.pcm, c.sampleRate);
    }
    const head = headRef.current as unknown as {
      streamNotifyEnd: () => void;
    } | null;
    head?.streamNotifyEnd();
    streamOffsetMsRef.current = 0;
    // Reset jitter state for the next turn.
    jitterPrimedRef.current = false;
    jitterBufferRef.current = [];
  }, [flushChunkToHead]);

  // Resume TalkingHead's audioCtx from within a user gesture. Chrome's
  // autoplay policy leaves the context suspended otherwise, which makes
  // playAudio() bail before pushing viseme animations into animQueue —
  // i.e. audio plays but lips don't move.
  const resumeAudioCtx = useCallback(() => {
    const h = headRef.current as unknown as {
      audioCtx?: { state: string; resume: () => Promise<void> };
    } | null;
    if (h?.audioCtx?.state === "suspended") {
      h.audioCtx.resume().catch(() => {});
    }
  }, []);

  const beginListening = useCallback(() => {
    if (callStatus !== "ready" || isRecording) return;
    resumeAudioCtx();
    sessionRef.current?.startRecording();
    setIsRecording(true);
  }, [callStatus, isRecording, resumeAudioCtx]);

  const endListening = useCallback(() => {
    if (!isRecording) return;
    sessionRef.current?.stopRecording();
    setIsRecording(false);
    setCallStatus("thinking");
  }, [isRecording]);

  // Hold-Space-to-talk anywhere on the page (skips inputs/textareas just in case).
  useEffect(() => {
    const isTypingTarget = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el?.matches?.("textarea, input, [contenteditable='true']");
    };

    function onDown(e: KeyboardEvent) {
      if (e.code !== "Space" || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      if (callStatus !== "ready" || isRecording) return;
      e.preventDefault();
      beginListening();
    }

    function onUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (!isRecording) return;
      e.preventDefault();
      endListening();
    }

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [callStatus, isRecording, beginListening, endListening]);

  async function startCall() {
    if (status !== "ready") return;
    resumeAudioCtx();
    setCallStatus("connecting");
    setCallError(null);

    // Spin up the streaming AudioWorklet inside the user gesture so Chrome's
    // autoplay policy lets the AudioContext stay running.
    try {
      await ensureStream();
    } catch (err) {
      setCallError(err instanceof Error ? err.message : t("audioInitFailed"));
      setCallStatus("idle");
      return;
    }

    const created = await createVoiceConversation({
      persona_id: avatar.id,
      persona_name: avatar.name,
      persona_blurb: avatar.blurb,
      voice: avatar.geminiVoice,
      locale,
      conversation_id: continueConversationId ?? null,
    });
    if (!created.ok) {
      setCallError(created.error ?? t("startCallFailed"));
      setCallStatus("idle");
      return;
    }
    conversationIdRef.current = created.data.conversation_id;

    const session = new BackendVoiceSession();
    sessionRef.current = session;

    session.onEvent = (e) => {
      if (e.type === "ready") {
        setCallStatus("ready");
        return;
      }
      if (e.type === "audio") {
        // Feed each Gemini Live chunk straight into TalkingHead's streaming
        // worklet — the worklet glues chunks together gap-free, so the avatar
        // can start speaking on the first ~100 ms chunk instead of waiting for
        // turn_complete.
        pushAudioChunk(e.pcm, e.sampleRate);
        return;
      }
      if (e.type === "turn_complete") {
        // Tell the worklet no more chunks are coming for this turn so it drains
        // cleanly and fires onAudioEnd → setStatus("ready"). Keep callStatus on
        // "thinking" until the backend sends another "ready" — Gemini Live
        // closes the session after each turn and the supervisor needs ~0.5–1 s
        // to spin up a fresh one, during which any audio we push is dropped.
        notifyStreamEnd();
        return;
      }
      if (e.type === "crisis_alert") {
        console.warn("crisis_alert on voice", e.resources);
        return;
      }
      if (e.type === "error") {
        setCallError(e.message);
        setCallStatus("idle");
      }
    };

    try {
      await session.open(conversationIdRef.current!);
    } catch (err) {
      setCallError(err instanceof Error ? err.message : String(err));
      setCallStatus("idle");
      sessionRef.current = null;
    }
  }

  function endCall() {
    sessionRef.current?.close();
    sessionRef.current = null;
    stopStream();
    setCallStatus("idle");
    setIsRecording(false);
  }

  const inCall = callStatus === "ready" || callStatus === "thinking";
  const statusLabel = isRecording
    ? t("listening")
    : callStatus === "thinking"
      ? t("responding", { name: avatar.name })
      : status === "speaking"
        ? t("speakingNow", { name: avatar.name })
        : t("holdMic");

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Top-left controls */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 md:left-6 md:top-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="bg-background/85 backdrop-blur"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
          {t("chooseAnother")}
        </Button>
        <div className="rounded-md border border-border bg-background/85 px-3 py-1.5 backdrop-blur">
          <p className="font-serif text-sm leading-none text-foreground">{avatar.name}</p>
        </div>
      </div>

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Card className="pointer-events-auto w-[280px] shadow-lg">
            <div className="flex flex-col items-center gap-3 p-5">
              <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={1.75} />
              <p className="font-serif text-sm text-foreground">
                {t("loading", { name: avatar.name, progress })}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Avatar load error overlay */}
      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <Card className="pointer-events-auto w-full max-w-md border-destructive/50 p-5 shadow-lg">
            <p className="font-serif text-base text-destructive">{t("loadError")}</p>
            {error && (
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {error}
              </pre>
            )}
          </Card>
        </div>
      )}

      {/* Bottom control bar */}
      {status !== "loading" && status !== "error" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 bg-gradient-to-t from-background via-background/85 to-transparent px-4 pb-8 pt-16">
          {callError && (
            <p
              role="alert"
              className="pointer-events-auto rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive backdrop-blur"
            >
              {callError}
            </p>
          )}

          {callStatus === "idle" && (
            <Button
              type="button"
              size="lg"
              onClick={startCall}
              className="pointer-events-auto"
            >
              <Phone className="mr-2 h-4 w-4" strokeWidth={1.75} />
              {t("startConversation")}
            </Button>
          )}

          {callStatus === "connecting" && (
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              {t("connecting")}
            </div>
          )}

          {inCall && (
            <>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {statusLabel}
              </p>
              <div className="pointer-events-auto flex items-center gap-6">
                <div className="w-12" aria-hidden />
                <button
                  type="button"
                  onMouseDown={beginListening}
                  onMouseUp={endListening}
                  onMouseLeave={() => isRecording && endListening()}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    beginListening();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    endListening();
                  }}
                  disabled={callStatus === "thinking" || status === "speaking"}
                  aria-label={isRecording ? t("recording") : t("holdToSpeak")}
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 shadow-lg transition-all",
                    isRecording
                      ? "border-destructive bg-destructive text-destructive-foreground scale-110"
                      : "border-primary bg-primary text-primary-foreground hover:scale-105",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <Mic className="h-6 w-6" strokeWidth={1.75} />
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={endCall}
                  aria-label={t("endCall")}
                  className="h-12 w-12 rounded-full bg-background/90 backdrop-blur"
                >
                  <PhoneOff className="h-5 w-5" strokeWidth={1.75} />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
