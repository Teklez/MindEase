import { getStoredToken } from "@/lib/api";

export type VoiceSessionEvent =
  | { type: "ready" }
  | { type: "audio"; pcm: ArrayBuffer; sampleRate: number; text: string }
  | { type: "transcript"; role: "user" | "ai"; text: string }
  | { type: "turn_complete" }
  | { type: "crisis_alert"; resources: unknown }
  | { type: "error"; message: string };

function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "";
  if (wsUrl) return wsUrl.replace(/^http/, "ws");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (apiUrl) return apiUrl.replace(/^http/, "ws");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function arrayBufferToB64(ab: ArrayBuffer): string {
  const u8 = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

export class BackendVoiceSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private recording = false;
  private closed = false;

  onEvent: (e: VoiceSessionEvent) => void = () => {};

  async open(conversationId: string): Promise<void> {
    const token = getStoredToken();
    if (!token) throw new Error("Not authenticated");
    const base = getWsBaseUrl();
    const sep = base.includes("?") ? "&" : "?";
    const url = `${base}/ws/voice/${conversationId}${sep}token=${encodeURIComponent(token)}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WS connection failed"));
      ws.onclose = (e) => {
        if (!this.closed) this.onEvent({ type: "error", message: `Closed: ${e.reason || e.code}` });
      };
      ws.onmessage = (ev) => this._handleMessage(ev);
    });

    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    const src = this.audioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.recording || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const f32 = e.inputBuffer.getChannelData(0);
      const i16 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
      }
      this.ws.send(
        JSON.stringify({
          type: "audio",
          data: arrayBufferToB64(i16.buffer),
          mime: "audio/pcm;rate=16000",
        }),
      );
    };

    src.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  startRecording(): void {
    this.recording = true;
    this.ws?.send(JSON.stringify({ type: "activity_start" }));
  }

  stopRecording(): void {
    this.recording = false;
    this.ws?.send(JSON.stringify({ type: "activity_end" }));
  }

  close(): void {
    this.closed = true;
    this.recording = false;
    this.processor?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
    this.ws?.close();
    this.ws = null;
  }

  private _handleMessage(ev: MessageEvent): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(ev.data as string) as Record<string, unknown>;
    } catch {
      return;
    }
    const t = msg.type as string;
    if (t === "ready") {
      this.onEvent({ type: "ready" });
      return;
    }
    if (t === "audio" && typeof msg.data === "string") {
      // Forward each Gemini Live chunk to the avatar IMMEDIATELY rather than
      // buffering until turn_complete. TalkingHead.speakAudio queues onto its
      // speechQueue so back-to-back calls play seamlessly, and the avatar can
      // start talking the moment the first ~100 ms chunk lands instead of
      // waiting for the full response.
      const rate = typeof msg.sample_rate === "number" ? msg.sample_rate : 24000;
      const ab = b64ToArrayBuffer(msg.data as string);
      this.onEvent({ type: "audio", pcm: ab, sampleRate: rate, text: "" });
      return;
    }
    if (t === "transcript") {
      const role = msg.role as "user" | "ai";
      const text = (msg.text as string) || "";
      this.onEvent({ type: "transcript", role, text });
      return;
    }
    if (t === "turn_complete") {
      this.onEvent({ type: "turn_complete" });
      return;
    }
    if (t === "crisis_alert") {
      this.onEvent({ type: "crisis_alert", resources: msg.resources });
      return;
    }
    if (t === "error") {
      this.onEvent({ type: "error", message: String(msg.message ?? "voice error") });
    }
  }
}
