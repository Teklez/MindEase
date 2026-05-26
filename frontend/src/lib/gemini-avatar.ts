import { apiRequest } from "@/lib/api";

export interface Persona {
  name: string;
  blurb: string;
}

export function resamplePCM(int16: Int16Array, srcRate: number, dstRate = 22050): Int16Array {
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
  { id: "Orus", label: "Orus", desc: "Confident · resonant" },
  { id: "Zephyr", label: "Zephyr", desc: "Bright · breezy" },
  { id: "Algenib", label: "Algenib", desc: "Gravelly · grounded" },
] as const;

export type GeminiVoiceId = (typeof GEMINI_VOICES)[number]["id"];

export interface TTSResult {
  pcm: ArrayBuffer;
  sampleRate: number;
  durationMs: number;
}

// One-shot TTS for the picker preview. The request hits our backend, which
// holds the Gemini API key — so this module no longer needs to ship the key
// to the browser. Live voice calls already go through the backend WS at
// BackendVoiceSession.
export async function fetchTTS(text: string, voiceName: GeminiVoiceId): Promise<TTSResult> {
  const res = await apiRequest<{ audio: string; sample_rate: number }>(
    "/api/v1/voice/tts",
    {
      method: "POST",
      body: JSON.stringify({ text, voice: voiceName }),
    },
  );
  if (!res.ok) {
    throw new Error(res.error ?? `TTS request failed (${res.status})`);
  }

  const { audio, sample_rate: srcRate } = res.data;
  const bin = atob(audio);
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);

  const src16 = new Int16Array(raw.buffer);
  const dst16 = resamplePCM(src16, srcRate, 22050);
  const durationMs = (src16.length / srcRate) * 1000;
  return { pcm: dst16.buffer as ArrayBuffer, sampleRate: 22050, durationMs };
}
