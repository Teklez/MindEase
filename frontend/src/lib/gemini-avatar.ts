import { GoogleGenAI, Modality, type LiveConnectConfig, type Session } from "@google/genai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface Persona {
  name: string;
  blurb: string;
}

const DEFAULT_PERSONA: Persona = {
  name: "Serenity",
  blurb: "Warm, attentive, easy to talk to.",
};

function buildSystemPrompt(persona: Persona = DEFAULT_PERSONA): string {
  return `You are ${persona.name}, a warm and empathetic AI wellness companion. \
Your style: ${persona.blurb} Stay in character as ${persona.name} throughout — \
if asked your name, you are ${persona.name}, never another assistant. \
You help people explore their feelings, provide emotional support, and offer gentle guidance \
using evidence-based approaches like CBT and mindfulness. \
Keep responses conversational, under 3 sentences unless more detail is truly needed. \
Be warm, never clinical. Never diagnose. Always validate feelings first.`;
}

function resamplePCM(int16: Int16Array, srcRate: number, dstRate = 22050): Int16Array {
  if (srcRate === dstRate) return int16;
  const ratio = srcRate / dstRate;
  const dstLen = Math.floor(int16.length / ratio);
  const out = new Int16Array(dstLen);
  for (let i = 0; i < dstLen; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, int16.length - 1);
    const t = pos - lo;
    const flo = int16[lo] >= 0x8000 ? int16[lo] - 0x10000 : int16[lo];
    const fhi = int16[hi] >= 0x8000 ? int16[hi] - 0x10000 : int16[hi];
    out[i] = Math.round(Math.max(-32768, Math.min(32767, flo * (1 - t) + fhi * t)));
  }
  return out;
}

export const GEMINI_VOICES = [
  { id: "Kore", label: "Kore", desc: "Warm · friendly" },
  { id: "Aoede", label: "Aoede", desc: "Bright · clear" },
  { id: "Charon", label: "Charon", desc: "Deep · calm" },
  { id: "Fenrir", label: "Fenrir", desc: "Steady · grounded" },
  { id: "Puck", label: "Puck", desc: "Upbeat · light" },
] as const;

export type GeminiVoiceId = (typeof GEMINI_VOICES)[number]["id"];

export interface TTSResult {
  pcm: ArrayBuffer;
  sampleRate: number;
  durationMs: number;
}

// One-shot Gemini TTS — used by picker previews and text-mode replies so
// every surface speaks with the same voice the live call uses.
export async function fetchTTS(text: string, voiceName: GeminiVoiceId): Promise<TTSResult> {
  const res = await fetch(
    `${BASE}/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini TTS API ${res.status}`);
  }
  const data = await res.json();
  const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData as
    | { data?: string; mimeType?: string }
    | undefined;
  if (!inline?.data) throw new Error("Gemini TTS returned no audio");

  const srcRate = parseInt(inline.mimeType?.match(/rate=(\d+)/)?.[1] ?? "24000", 10);
  const bin = atob(inline.data);
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);

  // Resample to 22050 Hz so TalkingHead's speakAudio gets what it expects.
  const src16 = new Int16Array(raw.buffer);
  const dst16 = resamplePCM(src16, srcRate, 22050);
  const durationMs = (src16.length / srcRate) * 1000;
  return { pcm: dst16.buffer as ArrayBuffer, sampleRate: 22050, durationMs };
}

export type VoiceSessionEvent =
  | { type: "ready" }
  | { type: "response"; pcm: ArrayBuffer; durationMs: number; text: string }
  | { type: "error"; message: string };

export class VoiceSession {
  private session: Session | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private recording = false;
  private rxChunks: Uint8Array[] = [];
  private rxText = "";
  private rxRate = 24000;
  private closed = false;

  onEvent: (e: VoiceSessionEvent) => void = () => {};

  async open(voiceName?: GeminiVoiceId, persona?: Persona) {
    const config: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: { parts: [{ text: buildSystemPrompt(persona) }] },
      outputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
      ...(voiceName && {
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      }),
    };

    this.session = await ai.live.connect({
      model: "models/gemini-2.5-flash-native-audio-latest",
      config,
      callbacks: {
        onopen: () => this.onEvent({ type: "ready" }),
        onmessage: (msg) => this._handleMessage(msg),
        onerror: (e) => this.onEvent({ type: "error", message: String(e) }),
        onclose: (e) => {
          if (!this.closed)
            this.onEvent({
              type: "error",
              message: `Closed: ${(e as CloseEvent).reason || (e as CloseEvent).code}`,
            });
        },
      },
    });

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    const src = this.audioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.recording || !this.session) return;
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++)
        i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
      const u8 = new Uint8Array(i16.buffer);
      let bin = "";
      for (let k = 0; k < u8.length; k++) bin += String.fromCharCode(u8[k]);
      this.session.sendRealtimeInput({
        audio: {
          data: btoa(bin),
          mimeType: "audio/pcm;rate=16000",
        },
      });
    };

    src.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  startRecording() {
    this.recording = true;
    this.session?.sendRealtimeInput({ activityStart: {} });
  }

  stopRecording() {
    this.recording = false;
    this.session?.sendRealtimeInput({ activityEnd: {} });
  }

  close() {
    this.closed = true;
    this.recording = false;
    this.processor?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
    this.session?.close();
  }

  private _handleMessage(msg: unknown) {
    const m = msg as Record<string, unknown>;

    const sc = m.serverContent as Record<string, unknown> | undefined;
    if (!sc) return;

    const transcript = sc.outputTranscription as { text?: string } | undefined;
    if (transcript?.text) this.rxText += transcript.text;

    const parts = (sc.modelTurn as { parts?: unknown[] } | undefined)?.parts ?? [];
    for (const p of parts as Record<string, unknown>[]) {
      if (typeof p.text === "string") this.rxText += p.text;
      const id = p.inlineData as { data?: string; mimeType?: string } | undefined;
      if (id?.data) {
        this.rxRate = parseInt(id.mimeType?.match(/rate=(\d+)/)?.[1] ?? "24000", 10);
        const bin = atob(id.data);
        const raw = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
        this.rxChunks.push(raw);
      }
    }

    if (sc.turnComplete) {
      const total = this.rxChunks.reduce((s, c) => s + c.byteLength, 0);
      const combined = new Uint8Array(total);
      let off = 0;
      for (const c of this.rxChunks) {
        combined.set(c, off);
        off += c.byteLength;
      }
      const src16 = new Int16Array(combined.buffer);
      const dst16 = resamplePCM(src16, this.rxRate, 22050);
      const durMs = (src16.length / this.rxRate) * 1000;
      this.onEvent({
        type: "response",
        pcm: dst16.buffer as ArrayBuffer,
        durationMs: durMs,
        text: this.rxText || "…",
      });
      this.rxChunks = [];
      this.rxText = "";
    }
  }
}
