---
date: 2026-04-21T18:45:00+02:00
researcher: anatoli
git_commit: c1fa0d48f83cb90abc77f8ca35d84f3c3471ccc9
branch: feature/upgrade-amharic-translation
repository: MindEase
topic: "Therapist Avatar Session — SDS §3.2.4 / Use Case 5.5 — Implementation Approaches"
tags: [research, avatar, tts, lipsync, persona, websocket, rive, three.js, d-id, heygen, anam, live2d]
status: complete
last_updated: 2026-04-21
last_updated_by: anatoli
---

# Research: Therapist Avatar Session — SDS §3.2.4 / Use Case 5.5

**Date**: 2026-04-21  
**Git Commit**: `c1fa0d48f83cb90abc77f8ca35d84f3c3471ccc9`  
**Branch**: `feature/upgrade-amharic-translation`  
**Repository**: MindEase

---

## Research Question

What are all viable approaches for implementing the Therapist Avatar Session (SDS §3.2.4, Use Case 5.5)?  
The feature currently has: no avatar model, service, or visual component; no persona switching logic; no avatar session state management.

The app stack is: **Next.js 14 (React 18)** frontend · **FastAPI** backend · **FastAPI AI service** (Ollama + Gemini Flash) · **Redis** (configured but unused) · **PostgreSQL** · **WebSocket** chat already live.

---

## Summary

Five distinct rendering families are viable. They split cleanly into two groups:

- **Self-hosted** (Rive 2D, React Three Fiber 3D, Live2D, SVG/CSS): zero per-minute runtime cost, full control, requires art assets and more engineering.
- **Video AI APIs** (D-ID, HeyGen, Tavus, Anam): photorealistic output, fast to integrate, ongoing per-minute cost, vendor dependency.

Persona switching is purely a prompt-engineering concern, independent of the rendering layer. Session state maps naturally onto Redis (already in the stack but currently unused in the backend).

The strongest fit for MindEase right now is **Rive** (2D animated, self-hosted) + **ElevenLabs TTS with timestamps** for lip-sync, with **Anam AI** as a fallback/fast-path if timeline is tight and per-minute cost is acceptable.

---

## Existing Codebase Baseline

### AI Service (`ai-service/`)
- `app/routes/generate.py` — POST `/generate`; supports streaming and non-streaming; wraps Ollama with optional Amharic translation.
- `app/services/inference.py` — `InferenceService` calls Ollama `/api/chat` (streaming SSE or full JSON).
- `app/services/translator.py` — Google Gemini Flash for Amharic ↔ English.
- `prompts/system.txt` — Single monolithic system prompt (compassionate companion, safe-messaging rules, CBT hints, Ethiopia cultural context). No persona separation yet.
- No TTS, no voice, no audio pipeline anywhere in the codebase.

### Backend (`backend/`)
- `app/api/v1/chat.py` — WebSocket handler at `/ws/chat/{conversation_id}`; JWT auth via query param; calls `chat_service.process_message_stream`.
- `app/services/chat_service.py` — Saves messages, streams AI response, detects crisis, auto-logs mood.
- `app/config.py` — `REDIS_URL` declared; **Redis is not imported or used** in any Python file (`aioredis`/`redis-py` absent from `requirements.txt`).
- No session store beyond PostgreSQL.

### Frontend (`frontend/`)
- `src/lib/websocket.ts` — `ChatWebSocket` class; reconnect with exponential backoff (max 3 retries).
- `src/hooks/useWebSocket.ts` — React hook exposing `{ send, connectionStatus, disconnect }`.
- `src/components/chat/ChatContainer.tsx` — Top-level chat; wires WebSocket + message list + input.
- `src/app/layout.tsx` — Root layout mounts: `ThemeProvider`, `GoogleAuthProvider`, `ConversationsContext`.
- State management: **React Context only** (no Zustand, no Redux).
- Animations: CSS/Tailwind keyframes (`globals.css`), `tw-animate-css`; `BadgeCelebration.tsx` for confetti; `TypingIndicator.tsx` for dots.
- **No 3D, no canvas, no audio, no TTS dependency in `package.json`.**
- React version: `^18` (compatible with React Three Fiber v9).

---

## Detailed Findings by Approach

---

### Approach 1 — Rive (2D Animated, Self-Hosted)

#### What It Is
Rive is an interactive animation runtime with a **State Machine** built into the file format. You define inputs (`isTalking: Boolean`, `visemeIndex: Number`, `emotion: Enum`) in the Rive editor and the engine blends between states at runtime. The animation file (`.riv`) encodes all logic; React code just sets inputs.

#### React Integration
```bash
npm install @rive-app/react-canvas
```
```tsx
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";

const { RiveComponent, rive } = useRive({ src: "/therapist.riv", stateMachines: "TherapistSM", autoplay: true });
const visemeInput = useStateMachineInput(rive, "TherapistSM", "visemeIndex");
const emotionInput = useStateMachineInput(rive, "TherapistSM", "emotion");
```

- Package: `@rive-app/react-canvas` — **MIT**, ~80 KB gzip.
- Next.js: no SSR issues; renders on a `<canvas>` element.
- React 18: fully compatible.

#### Lip-Sync Pipeline
1. User message → FastAPI → Ollama reply text.
2. FastAPI calls **ElevenLabs `/v1/text-to-speech/{voice_id}/with-timestamps`** → returns audio (base64) + character-level timing.
3. Backend optionally runs **Rhubarb Lip Sync** (CLI, MIT) to convert timing → 9 phoneme shapes (A–X).
4. Frontend receives `{ audio_b64, viseme_timeline: [{time_ms, viseme_id}] }` over WebSocket.
5. `AudioContext.decodeAudioData` → `AudioBufferSourceNode.start()`.
6. `requestAnimationFrame` loop compares `AudioContext.currentTime` to timeline, sets `visemeInput.value`.

For real-time streaming (lower latency), skip Rhubarb and use `wawa-lipsync` (MIT) in-browser:
```bash
npm install wawa-lipsync
```
This analyses PCM amplitude via `AnalyserNode` → infers viseme in real-time, no TTS timestamp data needed.

#### Latency
44–74 ms total animation response time (below 100 ms perceptual threshold). Dominated by TTS TTFB.

#### ElevenLabs TTS cost (for reference)
- Starter: $5/month, 30K chars.
- Creator: $22/month, 100K chars.
- Flash v2.5: **75 ms TTFB**, highest quality at lowest latency.

#### Persona Switching with Rive
Each persona maps to a different Rive `emotion` input value (e.g., `0 = calm`, `1 = warm`, `2 = professional`) and optionally a different ElevenLabs `voice_id`. The avatar's expression states reflect the persona without needing separate `.riv` files.

#### Pros
- Zero per-minute runtime cost after asset creation.
- Full control over appearance, expressions, branding.
- State machine handles all blend/transition logic declaratively.
- Off-the-shelf marketplace assets available (see [Rive Marketplace — Talking Avatar](https://rive.app/marketplace/21097-39720-custom-talking-avatar-real-time-lip-sync-for-your-app/)).
- MIT runtime — no license risk.

#### Cons
- Requires a `.riv` asset (either buy from marketplace or commission an animator).
- Lip-sync pipeline adds backend complexity (Rhubarb subprocess or ElevenLabs integration).
- 2D style — not photorealistic.

#### Key Resources
- [Rive React Docs](https://rive.app/docs/runtimes/react/react)
- [DEV.to — Production AI Avatar with Rive + Voice AI (2026)](https://dev.to/uianimation/how-to-build-a-production-ready-ai-avatar-assistant-using-rive-voice-ai-and-api-integration-2026-580i)
- [DEV.to — Real-Time AI Lip Sync with Rive State Machine + Viseme Data](https://dev.to/uianimation/how-to-build-real-time-ai-lip-sync-using-rive-state-machine-viseme-data-26o7)
- [github.com/rive-app/awesome-rive](https://github.com/rive-app/awesome-rive)

---

### Approach 2 — React Three Fiber + Ready Player Me (3D, Self-Hosted)

#### What It Is
A full 3D avatar pipeline: React Three Fiber (R3F) wraps Three.js in React; Ready Player Me provides free GLB avatars with **ARKit-compatible blend shapes** pre-built in (including all Oculus visemes: `viseme_aa`, `viseme_CH`, `viseme_PP`, etc.). Mixamo supplies free body animations (idle, gestures). Morph targets on `SkinnedMesh` drive lip-sync.

#### React Integration
```bash
npm install three @react-three/fiber @react-three/drei
```
```tsx
// Auto-generated component from: npx gltfjsx therapist.glb
useFrame(() => {
  nodes.Wolf3D_Head.morphTargetInfluences[visemeIndex] =
    MathUtils.lerp(current, target, 0.1);
});
```

- `@react-three/fiber` v9 requires **React 18** — compatible with current `package.json`.
- `@react-three/drei` — helpers (OrbitControls, Environment, etc.).

#### Pre-built Drop-in Libraries
- **[agentic-avatars](https://github.com/NavodPeiris/agentic-avatars)** (`npm install agentic-avatars`) — wraps R3F + WebRTC voice agent. Supports ElevenLabs Conversational AI, OpenAI Realtime, Deepgram, Vapi, LiveKit. Three built-in avatars. Peer deps: React 18+, Three.js 0.160+, R3F 9+.
- **[TalkingHead](https://github.com/met4citizen/TalkingHead)** (MIT) — vanilla JS, full pipeline: TTS call (Google/ElevenLabs/Azure/OpenAI/Gemini) → phoneme converter → Oculus viseme blend shapes. Needs a React wrapper component.
- **[Conv-AI/RPM-Lipsync](https://github.com/Conv-AI/RPM-Lipsync)** — Convai lip-sync integration for RPM + R3F.

#### Lip-Sync
Morph target index mapped from viseme ID via `morphTargetDictionary`. Two modes:
1. **Amplitude-based** (`wawa-lipsync`, `AnalyserNode`) — works with any audio, no TTS dependency.
2. **Phoneme-based** (Rhubarb server-side or Azure viseme events) — accurate mouth shapes.

Full tutorial: [Wawa Sensei — Lip Sync React Three Fiber](https://wawasensei.dev/tuto/react-three-fiber-tutorial-lip-sync)  
Video: [YouTube — Lip Sync R3F Tutorial](https://www.youtube.com/watch?v=egQFAeu6Ihw)

#### Pros
- Highest visual quality of self-hosted options.
- Photorealistic or stylized — designer's choice.
- Zero per-minute cost.
- `agentic-avatars` can bootstrap to a working demo in hours.
- Full 3D body — supports gestures, idle animations, spatial positioning.

#### Cons
- Most complex setup: Blender exports, morph target mapping, shader tuning.
- Bundle size impact (~500 KB+ for Three.js).
- Requires careful `dynamic(() => import(...), { ssr: false })` wrapping for Next.js.
- React 19 not yet supported by R3F (no issue for MindEase, which is on React 18).

#### Key Resources
- [Ready Player Me React Integration](https://docs.readyplayer.me/ready-player-me/integration-guides/react)
- [github.com/NavodPeiris/agentic-avatars](https://github.com/NavodPeiris/agentic-avatars)
- [github.com/met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead)

---

### Approach 3 — Video AI APIs (D-ID / HeyGen / Tavus / Anam)

All four use **WebRTC streaming** and charge per conversation minute. No 3D/2D animation expertise required — send text or audio, receive a video stream of a realistic face.

#### D-ID
- Architecture: WebRTC (ICE/STUN/TURN), Kubernetes + gRPC on Azure GPU.
- Latency: **<200 ms** end-to-end; lip movement within 30 ms of audio.
- API: REST + WebSocket stream negotiation. Node.js + Python SDKs.
- Avatar options: V4 Expressive (emotion states), V3 Pro, V3 Instant (upload own video).
- TTS selectable: ElevenLabs, Microsoft Speech, Amazon Polly.
- Pricing: API tier starts ~$18/month. Streaming credits ~$5.90/min (halved for API customers → ~$2.95/min).
- Docs: [docs.d-id.com/docs/quickstart](https://docs.d-id.com/docs/quickstart)
- Pricing: [d-id.com/pricing/api/](https://www.d-id.com/pricing/api/)

#### HeyGen
- SDK: `@heygen/streaming-avatar` on npm. Official Next.js demo available.
- Transport: WebRTC via LiveKit or native WebRTC. Full mode (higher quality) vs. Lite mode (cheaper).
- Pricing: 1 credit = $0.10. Full mode: $0.20/min. Lite mode: $0.10/min. Starter plan $19/month = 150 credits.
- **Note**: API keys currently gated behind Enterprise; trial tokens available on Creator/Teams plans.
- npm: [@heygen/streaming-avatar](https://www.npmjs.com/package/@heygen/streaming-avatar)
- Next.js demo: [HeyGen-Official/StreamingAvatarTSDemo](https://github.com/HeyGen-Official/StreamingAvatarTSDemo)
- Pricing: [heygen.com/api-pricing](https://www.heygen.com/api-pricing)

#### Tavus (CVI)
- Unique: train a "Replica" on ~2 min of video footage — avatar looks/sounds like a real person.
- Architecture: full end-to-end pipeline (STT + LLM + video rendering).
- Latency: **<500 ms** end-to-end.
- Pricing: Free 25 min/month. Starter $59/month (100 min). Growth $397/month (1,250 min). Overage $0.32/min.
- 30-second minimum per conversation.
- Docs: [docs.tavus.io](https://docs.tavus.io/sections/conversational-video-interface/overview-cvi)
- Pricing: [tavus.io/pricing](https://www.tavus.io/pricing)

#### Anam AI ⭐ Recommended if going video-AI route
- Focus: explicitly supports **mental health** use cases.
- Latency: **180 ms**.
- 70+ language support (relevant for Amharic if needed).
- Pricing:
  - Free: 30 min/month, 1 session, 3 min cap/conversation
  - Starter: 50 min/month, ~$0.16/min overage
  - Explorer: 250 min/month, ~$0.14/min, 3 sessions
  - Growth: 2,000 min/month, ~$0.12/min, 5 sessions
  - Professional: 5,000 min/month, ~$0.11/min, 10 sessions
- API: [anam.ai/api](https://anam.ai/api)
- Pricing: [anam.ai/pricing](https://anam.ai/pricing)

#### Video AI Comparison Table

| Service | Latency | Min cost/min | React SDK | Custom avatar |
|---------|---------|-------------|-----------|---------------|
| D-ID | <200 ms | ~$2.95 | Node.js SDK | Upload video |
| HeyGen | N/A | $0.10 (Lite) | `@heygen/streaming-avatar` | Train on footage |
| Tavus | <500 ms | $0.32 | REST | ~2 min video replica |
| Anam | 180 ms | ~$0.11 | REST + WebSocket | Custom avatar |

#### Pros (all video AI)
- Photorealistic output.
- No animation or art assets needed.
- Weeks to MVP vs. months for self-hosted.

#### Cons (all video AI)
- Per-minute cost compounds at scale (1,000 users × 20 min/session = $2,200–$59,000/month at scale).
- Vendor lock-in.
- **HIPAA**: none of the four publish BAA availability clearly (Tavus mentions Enterprise; others silent). **Critical blocker for a clinical mental health app.**
- Network dependency — WebRTC adds infrastructure complexity.

---

### Approach 4 — Live2D / Cubism (VTuber-Style 2D Rigged)

#### What It Is
A 2D illustration with a rig of bones and deformers. Cubism 5 added viseme-based lip-sync (time-series of viseme IDs → mouth blending via the `LipSync` module). Very distinctive anime/VTuber aesthetic.

#### Browser Integration
- `CubismWebFramework` — TypeScript SDK. No React-native wrapper; requires manual canvas management.
- `pixi-live2d-display` — PixiJS plugin, much easier API. Supports Cubism 2.1, 3, 4. Use in React via `<canvas>` ref.
- `pixi-live2d-display-lip-sync` fork — adds audio-driven lip-sync on top.
- Volume-based lip-sync (no phoneme data needed): RMS amplitude → mouth open parameter (0–1).

Full docs: [docs.live2d.com — Lip-sync from Wav Files (Web)](https://docs.live2d.com/en/cubism-sdk-tutorials/native-lipsync-from-wav-web/)

#### Licensing — Critical
Live2D SDK is **not open source**:
- Free below **¥20M (~$130K USD) annual revenue**.
- Above threshold: ~$630 one-time OR ~$50/month running royalty (middle-scale).
- Logo attribution required at all tiers.
- License: [live2d.com/en/sdk/license/](https://www.live2d.com/en/sdk/license/)

#### Pros
- Distinctive, charming aesthetic — may appeal to younger users.
- Mature toolchain (Cubism Editor).
- Volume-based lip-sync requires no TTS timing data.

#### Cons
- Tonally mismatched for a Western clinical mental health context.
- Significant art investment (Cubism Editor workflow).
- Complex React integration (canvas management).
- License revenue threshold is a future risk.

---

### Approach 5 — SVG/CSS + Lottie (Lightweight, No Lip-Sync)

Best as a **stepping stone** or fallback, not a full avatar solution.

- SVG paths swapped via `classList` on viseme events — works but extremely tedious to build expressive characters.
- Lottie (`@lottiefiles/dotlottie-react`, MIT) plays back After Effects animations. No native lip-sync — workaround: export multiple mouth-shape animations and cross-fade on viseme events.
- Both: zero cost, zero latency for animation, minimal bundle impact.
- Practical use in MindEase: Lottie for **idle/breathing animation** layered under a separate lip-sync layer.

---

## Viseme Lip-Sync Primer

A viseme is the visual mouth shape for a phoneme. Multiple phonemes share one viseme (e.g., /s/ and /z/ look identical).

| Standard | Count | Used by |
|----------|-------|---------|
| Oculus 15 | 15 | Ready Player Me blend shapes |
| Azure 22 | 22 | Azure Cognitive Services Speech SDK |
| Rhubarb 9 | 9 | Rhubarb CLI (A–X, language-agnostic option) |

### TTS APIs That Expose Timing Data

**ElevenLabs `/v1/text-to-speech/{voice_id}/with-timestamps`**
- Returns audio (base64) + character-level timing array.
- Flash v2.5: 75 ms TTFB.
- For streaming: standard endpoint does not emit viseme events mid-stream; buffer audio then run Rhubarb server-side, or use amplitude-based sync (`wawa-lipsync`) in-browser.
- [Docs](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps)

**Azure Cognitive Services Speech SDK**
- `synthesizer.visemeReceived` event fires `visemeId` (0–21) + `audioOffset` (100ns ticks).
- Requires WebSocket-based JS SDK — does **not** work via REST.
- [Microsoft Learn — Viseme Docs](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme)

**Web Speech API (browser)**
- `window.speechSynthesis` fires word/sentence `boundary` events — no phoneme/viseme events, no raw audio. **Not suitable for accurate lip-sync.**

### Browser-Side Lip-Sync Libraries

| Library | Approach | License | Notes |
|---------|----------|---------|-------|
| [wawa-lipsync](https://github.com/wass08/wawa-lipsync) | Real-time amplitude → viseme via `AnalyserNode` | MIT | Works with any audio source; best for streaming |
| [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) | CLI: audio file → `[{time, phoneme}]` JSON | MIT | Run on FastAPI, pass timeline to frontend |
| [lipsync-engine](https://github.com/Amoner/lipsync-engine) | Zero-dep, `AudioWorklet`-based real-time | MIT | Streaming-first |
| [TalkingHead](https://github.com/met4citizen/TalkingHead) | Full pipeline: TTS → phonemes → Oculus visemes | MIT | Vanilla JS, needs React wrapper |
| [HeadTTS](https://github.com/met4citizen/HeadTTS) | In-browser neural TTS (Kokoro, WebGPU/WASM) + timestamps | MIT | No server TTS needed |

---

## Persona Switching — Architecture

### Core Pattern: Modular System Prompt

The current `prompts/system.txt` is a single monolithic file. A persona-switching architecture splits it into:

```
[LOCKED — safety rules, crisis protocol, medical disclaimer]
[PERSONA BLOCK — swapped per session/request]
```

Example persona block:
```
--- ACTIVE PERSONA ---
Name: Dr. Maya
Style: Warm, Socratic, CBT-oriented
Tone: Calm, curious, non-judgmental
Approach: Ask reflective questions before offering interpretations
Voice: Uses "I notice..." and "What comes up for you when..."
--- END PERSONA ---
```

### Persona → Avatar Mapping

```python
PERSONAS = {
    "calm_cbt": {
        "system_block": "...",
        "elevenlabs_voice_id": "...",
        "rive_emotion": 0,   # maps to Rive state machine input
        "avatar_color_theme": "blue"
    },
    "warm_supportive": { ... },
    "professional": { ... }
}
```

### Structured LLM Output for Emotion Extraction

Add a second LLM call (or use structured output from the same call) to extract `emotion` from the reply:

```python
class TherapistReply(BaseModel):
    reply: str
    emotion: Literal["neutral", "empathetic", "encouraging", "concerned"]
    suggested_exercise: str | None
```

The `emotion` field drives the Rive state machine or 3D avatar expression blend. This keeps context windows small and prevents persona bleed.

### UI Pattern for Persona Selection
- Show persona selector on session start (before first message).
- Cards with avatar preview image + persona name + brief description.
- Store selected persona in frontend session context + send `persona_id` with each WebSocket message.
- Backend maps `persona_id` → system prompt block + voice ID.

---

## Session State Management

### What Needs to Be Tracked

| State | Scope | Suggested Store |
|-------|-------|-----------------|
| `persona_id` | Session | WebSocket message payload + Redis |
| `conversation_history` | Session | PostgreSQL (already persisted) |
| `current_emotion` | Real-time | Frontend React Context |
| `viseme_timeline` | Per-response | WebSocket message payload |
| `tts_audio` | Per-response | WebSocket message payload (base64) or S3 URL |
| `session_metadata` (start time, duration, turn count) | Session | Redis + PostgreSQL |

### WebSocket vs. Polling

The existing WebSocket at `/ws/chat/{conversation_id}` is already the right transport. For avatar sessions, the message schema extends to:

```json
{
  "type": "ai_response",
  "content": "That sounds really difficult...",
  "emotion": "empathetic",
  "audio_b64": "...",
  "viseme_timeline": [{"t": 0, "v": 3}, {"t": 120, "v": 7}],
  "is_streaming": false
}
```

Streaming responses: send `type: "stream_chunk"` text tokens first (existing behavior), then send `type: "audio_ready"` when TTS completes. Avatar shows typing animation during text stream, then switches to lip-sync when audio arrives.

### Redis for Session State

Redis is already declared in `backend/app/config.py` and `docker-compose.yml` but unused. For avatar sessions, add `aioredis` to `backend/requirements.txt` and use it for:

```python
# Store persona per conversation
await redis.setex(f"persona:{conversation_id}", 3600, persona_id)

# Store session metrics
await redis.hincrby(f"session:{conversation_id}", "turn_count", 1)
```

---

## Architecture Comparison (Decision Matrix)

| Approach | Visual quality | Setup effort | Per-min cost | Latency | HIPAA-safe | Best for |
|----------|---------------|-------------|-------------|---------|-----------|---------|
| SVG/CSS | Low | Low | $0 | ~0 ms | Yes | Quick prototype |
| Lottie | Medium | Low | $0 | ~0 ms | Yes | Idle animations only |
| **Rive** | **Medium–High** | **Medium** | **$0 runtime** | **44–74 ms** | **Yes** | **Custom 2D, full control** |
| R3F + RPM | High | High | $0 + TTS | ~75 ms + TTS | Yes | Realistic 3D, no API cost |
| D-ID | Very high | Low | ~$2.95/min | <200 ms | Unknown | Fast to production |
| HeyGen | Very high | Low | $0.10–0.20/min | N/A | Unknown | Pre-made avatars |
| Tavus | Very high | Low | $0.32/min | <500 ms | Enterprise only | Custom human replica |
| **Anam** | **High** | **Low** | **$0.11/min** | **180 ms** | **Unknown** | **Mental health focus, low cost** |
| Live2D | Medium (anime) | High | $0 (below threshold) | ~0 ms | Yes | VTuber aesthetic |

---

## Recommended Approach for MindEase

### Primary: Rive + ElevenLabs + Wawa-Lipsync

**Why:**
1. Zero per-minute runtime cost — no vendor dependency at scale.
2. Rive marketplace has ready-made talking avatar `.riv` files; time-to-first-demo is days, not months.
3. State machine maps cleanly onto persona emotions without separate assets per persona.
4. ElevenLabs Flash v2.5 (75 ms TTFB) + wawa-lipsync in-browser handles streaming without needing full timestamp data.
5. React 18 + Next.js 14 — no compatibility issues.
6. Self-hosted = HIPAA-compliant data flow (audio processed in-browser after delivery).

**Fast path (day 1–3):** Buy a talking avatar from [Rive Marketplace](https://rive.app/marketplace/21097-39720-custom-talking-avatar-real-time-lip-sync-for-your-app/), wire `@rive-app/react-canvas` into a new `AvatarSession` component, test with amplitude-based lip-sync (wawa-lipsync, no TTS needed yet).

**Full path (week 1–3):** Add ElevenLabs TTS to FastAPI AI service, send `audio_b64 + viseme_timeline` over existing WebSocket, swap amplitude-based sync for viseme-driven sync.

### Fallback / Fast-Track: Anam AI

If the avatar session must ship in < 1 week and the team can accept a ~$0.12/min cost:
- Anam explicitly targets mental health.
- 180 ms latency.
- Free tier (30 min/month) sufficient for early beta testing.
- REST + WebSocket API, no SDK installation required.

### Do NOT use (for now)
- **Tavus/D-ID/HeyGen**: pricing is prohibitive at scale; HIPAA BAA availability unconfirmed.
- **Live2D**: anime aesthetic tonally inconsistent with a clinical mental health app.
- **R3F + RPM**: highest quality but weeks of setup; revisit after Rive MVP ships.

---

## Code References

- `ai-service/prompts/system.txt` — current monolithic system prompt (needs splitting for persona support)
- `ai-service/app/routes/generate.py` — POST `/generate`; streaming pipeline entry point
- `ai-service/app/services/inference.py` — Ollama call; extend here for structured outputs
- `backend/app/api/v1/chat.py` — WebSocket handler; extend message schema for `audio_b64 + viseme_timeline`
- `backend/app/services/chat_service.py` — `process_message_stream`; add TTS call after LLM reply
- `backend/app/config.py` — `REDIS_URL` declared; add `aioredis` import for session state
- `frontend/src/lib/websocket.ts` — WebSocket client; handles message events
- `frontend/src/hooks/useWebSocket.ts` — React hook; add `onAudioReady` callback
- `frontend/src/components/chat/ChatContainer.tsx` — mount `AvatarSession` component here
- `frontend/package.json` — no 3D/audio deps yet; add `@rive-app/react-canvas` + `wawa-lipsync`

---

## Open Questions

1. **HIPAA / PDPA compliance**: Are any video AI vendors (D-ID, HeyGen, Anam) willing to sign a BAA? Must confirm before using cloud rendering for a clinical app.
2. **Art assets**: Will the team commission a custom `.riv` character or use a marketplace asset? Affects branding and timeline.
3. **Amharic TTS**: ElevenLabs and Azure both support Amharic — verify voice quality before committing to a TTS vendor. Anam claims 70+ languages; confirm Amharic specifically.
4. **Streaming visemes**: ElevenLabs streaming endpoint does not emit viseme events mid-stream (only batch endpoint does). Decide: accept amplitude-based sync for streaming, or buffer full response and add latency?
5. **Persona storage**: Should personas live in a DB table (editable per user/therapist) or in a config file (simpler)? Config is fine for MVP; DB needed for multi-tenancy.
6. **Avatar during crisis**: When `is_crisis = True` (already detected in `chat_service.py`), what does the avatar do? Switch to a specific calm/concerned expression? This is a UX decision needed before implementation.

---

## Related Research

- `docs/research/2026-03-16-sds-implementation-status.md` — Overall implementation status snapshot

---

`RESEARCH_FILE_PATH=docs/research/2026-04-21-therapist-avatar-session-approaches.md`
