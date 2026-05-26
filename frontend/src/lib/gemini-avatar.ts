const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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
] as const;

export type GeminiVoiceId = (typeof GEMINI_VOICES)[number]["id"];

export interface TTSResult {
  pcm: ArrayBuffer;
  sampleRate: number;
  durationMs: number;
}

// One-shot Gemini TTS — used by picker previews so personas have a sound
// before the user opens a Live session. Live calls now go through the backend.
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

  const src16 = new Int16Array(raw.buffer);
  const dst16 = resamplePCM(src16, srcRate, 22050);
  const durationMs = (src16.length / srcRate) * 1000;
  return { pcm: dst16.buffer as ArrayBuffer, sampleRate: 22050, durationMs };
}
