import { GoogleGenAI, Modality, type LiveConnectConfig, type Session } from '@google/genai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const BASE    = 'https://generativelanguage.googleapis.com/v1beta/models';
const ai      = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_PROMPT = `You are Serenity, a warm and empathetic AI wellness companion. \
You help people explore their feelings, provide emotional support, and offer gentle guidance \
using evidence-based approaches like CBT and mindfulness. \
Keep responses conversational, under 3 sentences unless more detail is truly needed. \
Be warm, never clinical. Never diagnose. Always validate feelings first.`;

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatAudioResult {
  text: string;
  pcm: ArrayBuffer;
  durationMs: number;
}

function resamplePCM(int16: Int16Array, srcRate: number, dstRate = 22050): Int16Array {
  if (srcRate === dstRate) return int16;
  const ratio  = srcRate / dstRate;
  const dstLen = Math.floor(int16.length / ratio);
  const out    = new Int16Array(dstLen);
  for (let i = 0; i < dstLen; i++) {
    const pos = i * ratio;
    const lo  = Math.floor(pos);
    const hi  = Math.min(lo + 1, int16.length - 1);
    const t   = pos - lo;
    const flo = int16[lo] >= 0x8000 ? int16[lo] - 0x10000 : int16[lo];
    const fhi = int16[hi] >= 0x8000 ? int16[hi] - 0x10000 : int16[hi];
    out[i]    = Math.round(Math.max(-32768, Math.min(32767, flo * (1 - t) + fhi * t)));
  }
  return out;
}

export const GEMINI_VOICES = [
  { id: 'Kore',   label: 'Kore',   desc: 'Warm · friendly'   },
  { id: 'Aoede',  label: 'Aoede',  desc: 'Bright · clear'    },
  { id: 'Charon', label: 'Charon', desc: 'Deep · calm'       },
  { id: 'Fenrir', label: 'Fenrir', desc: 'Steady · grounded' },
  { id: 'Puck',   label: 'Puck',   desc: 'Upbeat · light'    },
] as const;

export type GeminiVoiceId = typeof GEMINI_VOICES[number]['id'];

// ─── Text chat (for text input mode) ──────────────────────────────────────────

async function fetchText(userMessage: string, history: ChatMessage[]): Promise<string> {
  const res = await fetch(`${BASE}/gemini-3-flash-preview:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: userMessage }] },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini text API ${res.status}`);
  }
  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') ?? '…'
  );
}

export async function fetchReply(userMessage: string, history: ChatMessage[]): Promise<string> {
  return fetchText(userMessage, history);
}

// ─── Voice session (Gemini Live API) ──────────────────────────────────────────

export type VoiceSessionEvent =
  | { type: 'ready' }
  | { type: 'response'; pcm: ArrayBuffer; durationMs: number; text: string }
  | { type: 'error'; message: string };

export class VoiceSession {
  private session: Session | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private recording = false;
  private rxChunks: Uint8Array[] = [];
  private rxText = '';
  private rxRate = 24000;
  private closed = false;

  onEvent: (e: VoiceSessionEvent) => void = () => {};

  async open(voiceName?: GeminiVoiceId) {
    const config: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      outputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
      ...(voiceName && {
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      }),
    };

    this.session = await ai.live.connect({
      model: 'models/gemini-2.5-flash-native-audio-latest',
      config,
      callbacks: {
        onopen:   ()    => this.onEvent({ type: 'ready' }),
        onmessage: (msg) => this._handleMessage(msg),
        onerror:  (e)   => this.onEvent({ type: 'error', message: String(e) }),
        onclose:  (e)   => {
          if (!this.closed)
            this.onEvent({ type: 'error', message: `Closed: ${(e as CloseEvent).reason || (e as CloseEvent).code}` });
        },
      },
    });

    // Mic capture at 16 kHz
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.audioCtx  = new AudioContext({ sampleRate: 16000 });
    const src      = this.audioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.recording || !this.session) return;
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++)
        i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
      this.session.sendRealtimeInput({
        audio: { data: btoa(String.fromCharCode(...new Uint8Array(i16.buffer))), mimeType: 'audio/pcm;rate=16000' },
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

    // Native audio transcription comes separately as outputTranscription
    const transcript = sc.outputTranscription as { text?: string } | undefined;
    if (transcript?.text) this.rxText += transcript.text;

    const parts = (sc.modelTurn as { parts?: unknown[] } | undefined)?.parts ?? [];
    for (const p of parts as Record<string, unknown>[]) {
      if (typeof p.text === 'string') this.rxText += p.text;
      const id = p.inlineData as { data?: string; mimeType?: string } | undefined;
      if (id?.data) {
        this.rxRate = parseInt(id.mimeType?.match(/rate=(\d+)/)?.[1] ?? '24000', 10);
        const bin = atob(id.data);
        const raw = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
        this.rxChunks.push(raw);
      }
    }

    if (sc.turnComplete) {
      const total    = this.rxChunks.reduce((s, c) => s + c.byteLength, 0);
      const combined = new Uint8Array(total);
      let off = 0;
      for (const c of this.rxChunks) { combined.set(c, off); off += c.byteLength; }
      const src16 = new Int16Array(combined.buffer);
      const dst16 = resamplePCM(src16, this.rxRate, 22050);
      const durMs = (src16.length / this.rxRate) * 1000;
      this.onEvent({ type: 'response', pcm: dst16.buffer, durationMs: durMs, text: this.rxText || '…' });
      this.rxChunks = [];
      this.rxText   = '';
    }
  }
}
