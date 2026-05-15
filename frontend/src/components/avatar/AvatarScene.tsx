"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TalkingHead } from "@met4citizen/talkinghead";
import { LipsyncEn } from "@met4citizen/talkinghead/modules/lipsync-en.mjs";
import {
  ArrowLeft,
  Loader2,
  Mic,
  Pause,
  Phone,
  PhoneOff,
  Play,
  Sparkles,
} from "lucide-react";
import {
  fetchTTS,
  resamplePCM,
  type GeminiVoiceId,
} from "@/lib/gemini-avatar";
import { BackendVoiceSession } from "@/lib/backend-voice";
import { createVoiceConversation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AvatarBody = "F" | "M";
type AvatarStatus = "loading" | "ready" | "speaking" | "error";

type AvatarOption = {
  id: string;
  name: string;
  blurb: string;
  intro: string;
  url: string | null;
  body: AvatarBody;
  geminiVoice: GeminiVoiceId;
};

const AVATARS: AvatarOption[] = [
  {
    id: "serenity",
    name: "Serenity",
    blurb: "Warm, attentive, easy to talk to.",
    intro:
      "Hi, I'm Serenity. I'm here to listen — whatever's on your mind, take your time.",
    url: "/avatars/brunette.glb",
    body: "F",
    geminiVoice: "Kore",
  },
  {
    id: "maya",
    name: "Maya",
    blurb: "Steady and grounded.",
    intro: "Hello, I'm Maya. Let's slow things down and think them through, together.",
    url: "/avatars/brunette.glb",
    body: "F",
    geminiVoice: "Fenrir",
  },
  {
    id: "alex",
    name: "Alex",
    blurb: "Bright and curious.",
    intro: "Hey, I'm Alex. What's been on your mind today? I'd love to hear about it.",
    url: "/avatars/brunette.glb",
    body: "F",
    geminiVoice: "Puck",
  },
  {
    id: "sora",
    name: "Sora",
    blurb: "Quiet and reflective.",
    intro: "Hi, I'm Sora. There's no rush here — start anywhere that feels right.",
    url: "/avatars/brunette.glb",
    body: "F",
    geminiVoice: "Aoede",
  },
  {
    id: "kai",
    name: "Kai",
    blurb: "Calm, low and slow.",
    intro: "Hey, I'm Kai. Take a breath. I'm right here whenever you're ready.",
    url: "/avatars/brunette.glb",
    body: "F",
    geminiVoice: "Charon",
  },
];

// LipsyncEn produces no visemes for tokens that aren't real words (e.g. "…",
// punctuation, or an empty string). When transcripts are missing or sparse we
// stuff in lipsync-friendly placeholders proportional to the audio duration so
// the mouth still moves to the speech.
const FALLBACK_WORDS = ["la", "le", "ma", "mo", "na", "no", "ba", "be"];
const LIPSYNC_WORD_RE = /[A-Za-z]/;

function buildLipsyncWords(text: string, durationMs: number) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
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

function estimateDuration(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length * 400;
}

function makeSilentPcm(durationMs: number): ArrayBuffer {
  return new Int16Array(Math.ceil((durationMs * 22050) / 1000)).buffer;
}

function AvatarPicker({ onSelect }: { onSelect: (a: AvatarOption) => void }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Cache TTS audio per avatar so re-clicking doesn't re-fetch.
  const cacheRef = useRef<Map<string, { pcm: ArrayBuffer; sampleRate: number }>>(new Map());
  // Tracks the active playback so we can stop it cleanly.
  const activeRef = useRef<{
    id: string;
    cancelled: boolean;
    src?: AudioBufferSourceNode;
    ctx?: AudioContext;
  } | null>(null);

  function stopActive() {
    const cur = activeRef.current;
    if (!cur) return;
    cur.cancelled = true;
    try {
      cur.src?.stop();
    } catch {
      /* already stopped */
    }
    cur.ctx?.close().catch(() => {});
    activeRef.current = null;
  }

  useEffect(() => {
    return () => stopActive();
  }, []);

  async function playPreview(a: AvatarOption) {
    setPreviewError(null);
    // Clicking the currently-playing avatar = toggle off.
    if (playingId === a.id) {
      stopActive();
      setPlayingId(null);
      return;
    }
    stopActive();

    const session: NonNullable<typeof activeRef.current> = { id: a.id, cancelled: false };
    activeRef.current = session;
    setPlayingId(a.id);

    try {
      let audio = cacheRef.current.get(a.id);
      if (!audio) {
        const tts = await fetchTTS(a.intro, a.geminiVoice);
        audio = { pcm: tts.pcm, sampleRate: tts.sampleRate };
        cacheRef.current.set(a.id, audio);
      }
      if (session.cancelled) return;

      const ctx = new AudioContext();
      const int16 = new Int16Array(audio.pcm);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      const buffer = ctx.createBuffer(1, float32.length, audio.sampleRate);
      buffer.copyToChannel(float32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => {
        if (activeRef.current === session) activeRef.current = null;
        setPlayingId((id) => (id === a.id ? null : id));
        ctx.close().catch(() => {});
      };
      session.src = src;
      session.ctx = ctx;
      src.start();
    } catch (err) {
      if (session.cancelled) return;
      console.error("Preview failed:", err);
      setPreviewError(err instanceof Error ? err.message : String(err));
      setPlayingId(null);
      activeRef.current = null;
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Pick a companion
        </p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground md:text-4xl">
          Who would you like to talk with?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Choose a face for your wellness companion — tap the play button to hear them
          first. You can switch any time.
        </p>
        {previewError && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Preview unavailable: {previewError}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AVATARS.map((a) => {
          const available = !!a.url;
          const playing = playingId === a.id;
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
                <Sparkles
                  className="h-10 w-10 text-muted-foreground/60"
                  strokeWidth={1.25}
                />
                {!available && (
                  <span className="absolute right-2 top-2 rounded-md border border-border bg-background/90 px-1.5 py-px text-[9.5px] uppercase tracking-wider text-muted-foreground">
                    Coming soon
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playPreview(a);
                  }}
                  aria-label={
                    playing ? `Stop preview for ${a.name}` : `Play preview for ${a.name}`
                  }
                  className={cn(
                    "absolute bottom-2 left-2 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-all",
                    playing
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/90 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary",
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
                    Speaking…
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

function AvatarViewer({
  avatar,
  onBack,
  continueConversationId,
}: {
  avatar: AvatarOption;
  onBack: () => void;
  continueConversationId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<TalkingHead | null>(null);
  const sessionRef = useRef<BackendVoiceSession | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pendingAiTextRef = useRef<string>("");

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
    // TEMP: lipsync diagnostics
    console.log("[avatar] lipsync.en attached:", head.lipsync.en, "keys:", Object.keys(head.lipsync.en ?? {}));
    setStatus("loading");
    setProgress(0);
    setError(null);

    head
      .showAvatar(
        { url: avatar.url, body: avatar.body, lipsyncLang: "en", avatarMood: "neutral" },
        (ev: ProgressEvent) => {
          if (ev.lengthComputable && ev.total > 0)
            setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      )
      .then(() => {
        setStatus("ready");
        // TEMP: confirm armature + viseme morph targets after model load
        const h = headRef.current as unknown as {
          armature?: { name?: string };
          lipsync?: Record<string, { wordsToVisemes?: (s: string) => unknown }>;
          morphs?: Array<{
            material?: { needsUpdate: boolean } | Array<{ needsUpdate: boolean }>;
            updateMorphTargets?: () => void;
          }>;
        } | null;
        const sample = h?.lipsync?.en?.wordsToVisemes?.("HELLO");
        console.log("[avatar] post-load:", {
          armature: h?.armature?.name ?? null,
          hasEnEngine: !!h?.lipsync?.en,
          sampleVisemes: sample,
        });
        // Force shader recompile + re-bind morph attributes on every mesh
        // that has morph targets. Without this, Next.js's bundling order
        // can leave the SkinnedMesh shader compiled before the morph
        // attributes are visible to Three.js's morph-texture packing,
        // so the influences are silently ignored at render time.
        h?.morphs?.forEach((m) => {
          m.updateMorphTargets?.();
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
      head.stop();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, [avatar]);

  const speakResponse = useCallback(
    async (text: string, pcm: ArrayBuffer | null, durationMs: number) => {
      setStatus("speaking");

      try {
        const t = new AudioContext();
        await t.resume();
        await t.close();
      } catch {
        /* ignore */
      }

      // Guard against zero-length audio (Gemini Live can return text with no audio frames).
      const hasRealAudio = !!pcm && pcm.byteLength > 0;
      const safeDurationMs = Math.max(
        durationMs > 0 ? durationMs : estimateDuration(text),
        200,
      );
      // Backend delivers raw 24 kHz PCM; resample to 22050 Hz for TalkingHead.
      let resampled: ArrayBuffer | null = pcm;
      if (hasRealAudio) {
        const src16 = new Int16Array(pcm!);
        const dst16 = resamplePCM(src16, 24000, 22050);
        resampled = dst16.buffer as ArrayBuffer;
      }
      const actualPcm = hasRealAudio ? resampled! : makeSilentPcm(safeDurationMs);
      const timing = estimateWordTimings(text, safeDurationMs);

      try {
        // TEMP: diagnostics on what we're handing TalkingHead
        console.log("[avatar] speakAudio call:", {
          textPreview: text.slice(0, 60),
          pcmBytes: actualPcm.byteLength,
          words: timing.words.length,
          firstWord: timing.words[0],
          firstWtime: timing.wtimes[0],
          firstWdur: timing.wdurations[0],
          hasRealAudio,
        });
        headRef.current?.speakAudio({
          audio: [actualPcm],
          words: timing.words,
          wtimes: timing.wtimes,
          wdurations: timing.wdurations,
        });
      } catch (err) {
        console.warn("speakAudio failed:", err);
      }

      if (!hasRealAudio) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = 0.95;
        utt.onend = () => setStatus("ready");
        window.speechSynthesis.speak(utt);
      }

      setTimeout(() => setStatus("ready"), safeDurationMs + 400);
    },
    [],
  );

  const beginListening = useCallback(() => {
    if (callStatus !== "ready" || isRecording) return;
    sessionRef.current?.startRecording();
    setIsRecording(true);
  }, [callStatus, isRecording]);

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
    setCallStatus("connecting");
    setCallError(null);

    const created = await createVoiceConversation({
      persona_id: avatar.id,
      persona_name: avatar.name,
      persona_blurb: avatar.blurb,
      voice: avatar.geminiVoice,
      conversation_id: continueConversationId ?? null,
    });
    if (!created.ok) {
      setCallError(created.error ?? "Failed to start call");
      setCallStatus("idle");
      return;
    }
    conversationIdRef.current = created.data.conversation_id;

    const session = new BackendVoiceSession();
    sessionRef.current = session;

    session.onEvent = (e) => {
      console.log("[voice] event:", e.type, "role" in e ? e.role : "");
      if (e.type === "ready") {
        setCallStatus("ready");
        return;
      }
      if (e.type === "transcript" && e.role === "ai") {
        pendingAiTextRef.current += e.text;
        return;
      }
      if (e.type === "audio") {
        // Prefer the text the backend bundled with the audio; fall back to
        // whatever streamed in via transcript events. Either one drives
        // viseme generation in TalkingHead.
        const text = (e.text || pendingAiTextRef.current).trim();
        pendingAiTextRef.current = "";
        const durationMs = (e.pcm.byteLength / 2 / e.sampleRate) * 1000;
        setCallStatus("ready");
        speakResponse(text, e.pcm, durationMs);
        return;
      }
      if (e.type === "turn_complete") {
        // Always re-enable the mic when a turn ends, even if no audio arrived.
        pendingAiTextRef.current = "";
        setCallStatus("ready");
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
    setCallStatus("idle");
    setIsRecording(false);
  }

  const inCall = callStatus === "ready" || callStatus === "thinking";
  const statusLabel = isRecording
    ? "Listening…"
    : callStatus === "thinking"
      ? `${avatar.name} is responding…`
      : status === "speaking"
        ? `${avatar.name} is speaking…`
        : "Hold the mic, or press and hold Space";

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
          Choose another
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
                Loading {avatar.name}… {progress}%
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
            <p className="font-serif text-base text-destructive">Avatar failed to load</p>
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
            <div className="pointer-events-auto flex items-center gap-2">
              <Button
                type="button"
                size="lg"
                onClick={startCall}
              >
                <Phone className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Start conversation
              </Button>
              {/* TEMP: drives speakResponse with hardcoded text + browser TTS
                  so lipsync can be verified without spinning up a voice call. */}
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={status !== "ready"}
                onClick={() =>
                  speakResponse(
                    "Hello there. This is a quick test of the lipsync animation, my mouth should move in time with the words.",
                    null,
                    5000,
                  )
                }
              >
                Test lipsync
              </Button>
              {/* TEMP: dump morph-target wiring to console. The crucial
                  fields are mtAvatar.viseme_aa.ms.length (must be >0 for
                  the morph to reach a mesh) and isRunning (the rAF loop
                  must be active for updates to apply). */}
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  const h = headRef.current as unknown as {
                    mtAvatar?: Record<string, {
                      value: number;
                      applied: number;
                      baseline: number;
                      ms: Float32Array[];
                      is: number[];
                    }>;
                    morphs?: Array<{
                      name?: string;
                      morphTargetDictionary?: Record<string, number>;
                      morphTargetInfluences?: number[];
                    }>;
                    isRunning?: boolean;
                    armature?: { name?: string; visible?: boolean };
                  } | null;
                  if (!h) {
                    console.warn("[diag] head not mounted");
                    return;
                  }
                  const aa = h.mtAvatar?.viseme_aa;
                  console.log("[diag] viseme_aa wiring:", {
                    exists: !!aa,
                    value: aa?.value,
                    applied: aa?.applied,
                    baseline: aa?.baseline,
                    msLength: aa?.ms?.length,
                    isIndices: aa?.is,
                    isRunning: h.isRunning,
                    armatureVisible: h.armature?.visible,
                  });
                  console.log("[diag] meshes with viseme_aa:", h.morphs?.map((m) => ({
                    name: m.name,
                    hasViseme_aa: m.morphTargetDictionary?.viseme_aa !== undefined,
                    ndx: m.morphTargetDictionary?.viseme_aa,
                    currentInfluence:
                      m.morphTargetDictionary?.viseme_aa !== undefined
                        ? m.morphTargetInfluences?.[m.morphTargetDictionary.viseme_aa]
                        : null,
                  })));
                }}
              >
                Dump morphs
              </Button>
              {/* TEMP: use the `fixed` channel (priority over baseline) so
                  the morph stays at 1.0. If the mouth still doesn't move,
                  either the rAF loop isn't running or mtAvatar isn't wired
                  to a visible mesh. */}
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  const h = headRef.current as unknown as {
                    mtAvatar?: Record<string, {
                      fixed: number | null;
                      needsUpdate: boolean;
                      ms: Float32Array[];
                      is: number[];
                    }>;
                    morphs?: Array<{
                      morphTargetDictionary?: Record<string, number>;
                      morphTargetInfluences?: number[];
                    }>;
                  } | null;
                  const mt = h?.mtAvatar?.viseme_aa;
                  if (!mt) {
                    console.warn("[diag] viseme_aa morph target not found");
                    return;
                  }
                  // Path A: through the talkinghead update pipeline
                  mt.fixed = 1;
                  mt.needsUpdate = true;
                  // Path B: bypass talkinghead entirely — write straight to
                  // the mesh's morphTargetInfluences. If THIS doesn't move
                  // the mouth either, the morph itself doesn't deform the
                  // mesh (wrong target, wrong mesh, or mesh hidden).
                  h?.morphs?.forEach((m) => {
                    const ndx = m.morphTargetDictionary?.viseme_aa;
                    if (ndx !== undefined && m.morphTargetInfluences) {
                      m.morphTargetInfluences[ndx] = 1;
                    }
                  });
                  console.log("[diag] viseme_aa: set fixed=1 + raw influences=1");
                  setTimeout(() => {
                    mt.fixed = null;
                    mt.needsUpdate = true;
                    h?.morphs?.forEach((m) => {
                      const ndx = m.morphTargetDictionary?.viseme_aa;
                      if (ndx !== undefined && m.morphTargetInfluences) {
                        m.morphTargetInfluences[ndx] = 0;
                      }
                    });
                    console.log("[diag] viseme_aa released");
                  }, 2000);
                }}
              >
                Force aa
              </Button>
              {/* TEMP: deeper inspection — show the geometry-level morph
                  data and try multiple morph indices to isolate the issue. */}
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  const h = headRef.current as unknown as {
                    morphs?: Array<{
                      name?: string;
                      visible?: boolean;
                      type?: string;
                      morphTargetDictionary?: Record<string, number>;
                      morphTargetInfluences?: Float32Array | number[];
                      geometry?: {
                        morphAttributes?: { position?: unknown[]; normal?: unknown[] };
                        morphTargetsRelative?: boolean;
                      };
                      material?: { morphTargets?: boolean; type?: string };
                    }>;
                  } | null;
                  console.log("[diag] geometry-level morph info:",
                    h?.morphs?.map((m) => ({
                      name: m.name,
                      visible: m.visible,
                      type: m.type,
                      influencesLen: m.morphTargetInfluences?.length,
                      morphPositionsLen: m.geometry?.morphAttributes?.position?.length,
                      morphNormalsLen: m.geometry?.morphAttributes?.normal?.length,
                      morphTargetsRelative: m.geometry?.morphTargetsRelative,
                      materialType: m.material?.type,
                      materialMorphTargets: m.material?.morphTargets,
                    })),
                  );
                }}
              >
                Inspect geom
              </Button>
              {/* TEMP: cycle through ALL morph targets on Wolf3D_Head one
                  at a time so we can visually see which (if any) actually
                  deform. */}
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={async () => {
                  const h = headRef.current as unknown as {
                    morphs?: Array<{
                      name?: string;
                      morphTargetDictionary?: Record<string, number>;
                      morphTargetInfluences?: Float32Array | number[];
                    }>;
                  } | null;
                  const head = h?.morphs?.find((m) => m.name === "Wolf3D_Head");
                  if (!head?.morphTargetDictionary || !head.morphTargetInfluences) {
                    console.warn("[diag] Wolf3D_Head not found");
                    return;
                  }
                  const names = Object.keys(head.morphTargetDictionary);
                  console.log("[diag] cycling", names.length, "morphs on Wolf3D_Head — watch the face");
                  for (const name of names) {
                    const ndx = head.morphTargetDictionary[name];
                    head.morphTargetInfluences[ndx] = 1;
                    console.log("[diag]", name, "@", ndx, "= 1");
                    await new Promise((r) => setTimeout(r, 400));
                    head.morphTargetInfluences[ndx] = 0;
                  }
                  console.log("[diag] cycle done");
                }}
              >
                Cycle morphs
              </Button>
            </div>
          )}

          {callStatus === "connecting" && (
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Connecting…
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
                  aria-label={isRecording ? "Recording" : "Hold to speak"}
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
                  aria-label="End call"
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

export function AvatarScene({
  preselectPersonaId,
  continueConversationId,
}: {
  preselectPersonaId?: string;
  continueConversationId?: string | null;
} = {}) {
  const [selected, setSelected] = useState<AvatarOption | null>(() => {
    if (preselectPersonaId) {
      return AVATARS.find((a) => a.id === preselectPersonaId) ?? null;
    }
    return null;
  });

  if (!selected) return <AvatarPicker onSelect={setSelected} />;
  return (
    <AvatarViewer
      avatar={selected}
      onBack={() => setSelected(null)}
      continueConversationId={continueConversationId ?? null}
    />
  );
}
