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

  const speakResponse = useCallback(
    async (text: string, pcm: ArrayBuffer | null, durationMs: number) => {
      setStatus("speaking");

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
            <Button
              type="button"
              size="lg"
              onClick={startCall}
              className="pointer-events-auto"
            >
              <Phone className="mr-2 h-4 w-4" strokeWidth={1.75} />
              Start conversation
            </Button>
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
