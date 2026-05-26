---
title: Creating a new 3D avatar persona
audience: developers
last_updated: 2026-05-27
---

# Creating a new 3D avatar persona

This guide walks through everything needed to add a new talking-head persona to the avatar picker — from sourcing the GLB to wiring the persona into the codebase. Estimated time: ~10–15 min per new avatar once you've done it once.

## TL;DR

1. Sign up at [developer.avaturn.me](https://developer.avaturn.me), create a project, **enable Type-2 (T2) avatars** in project settings, copy your subdomain.
2. Edit `try-3d-avatar/avaturn-exporter.html`, set `SUBDOMAIN` to your project's subdomain.
3. Run `python3 -m http.server 8765` from `try-3d-avatar/`, open `http://localhost:8765/avaturn-exporter.html`.
4. Upload a selfie, customize, click **Next/Done** in the iframe → GLB auto-downloads.
5. Verify it's T2 (the file must be ~10–14 MB; T1 is ~4 MB and will not lipsync — see [Verifying T2](#verifying-the-export-is-t2) below).
6. Move into `frontend/public/avatars/<name>.glb`, add a row to `PERSONAS` in `AvatarScene.tsx`, add i18n entries in `en.json` and `am.json`.
7. Reload `/avatar`. The picker shows a live snapshot thumbnail; click play to hear lipsync.

---

## Why Avaturn (and not Ready Player Me)

Ready Player Me powered the original avatar pipeline (`brunette.glb` is an RPM export). **Netflix acquired RPM in December 2025 and shut down all public services on January 31, 2026.** DNS records for `readyplayer.me`, `models.readyplayer.me`, etc. no longer resolve. The existing `brunette.glb` keeps working only because it's bundled as a static file in `frontend/public/avatars/`.

The `@met4citizen/talkinghead` library (which drives our lipsync) explicitly endorses **Avaturn Type-2 (T2)** avatars as the drop-in RPM replacement. Avaturn T2 exports contain all 15 Oculus visemes (`viseme_aa`, `viseme_PP`, …) plus the standard 52 ARKit blendshapes that TalkingHead needs.

A second viable source is [Avatar SDK / MetaPerson](https://docs.metaperson.avatarsdk.com/), but it has no real free tier ($300+/mo) and requires two Blender preprocessing scripts. **Stick with Avaturn unless you have a reason not to.**

### T1 vs T2 — the one setting that matters

Avaturn ships two GLB types ([docs.avaturn.me/docs/integration/bodies](https://docs.avaturn.me/docs/integration/bodies/)):

- **T1** — static face, no blendshapes. The avatar loads, poses, animates body, but **the mouth does not move**. TalkingHead will hard-error: `"Blend shapes not found"`. **Do not use.**
- **T2** — animatable face with ARKit blendshapes and Oculus visemes baked in. Separate `Head_Mesh`, `Eye_Mesh`, `Teeth_Mesh`, `Tongue_Mesh`. **Use this.**

The Avaturn consumer Hub at [hub.avaturn.me](https://hub.avaturn.me) only exports T1 — there is no toggle in the consumer UI to switch to T2. **T2 is only available through the free developer SDK** at [developer.avaturn.me](https://developer.avaturn.me), via a project-level setting.

### Free vs paid

- **Web SDK route** (what we use): free for non-commercial use, no documented limit on number of avatars or exports. Sign up, create a project, you're done.
- **REST API**: $800/mo Pro plan. We do not use this — the Web SDK iframe route is enough.
- For commercial deployment of MindEase, contact `hello@avaturn.me` to clarify terms.

---

## Step 1: Set up your Avaturn dev project (one-time)

1. Go to [developer.avaturn.me](https://developer.avaturn.me) and sign up. Self-serve, instant — no manual approval.
2. After login, create a **new project**.
3. **In project settings, enable Type-2 (T2) avatars.** This is the critical setting — the SDK serves T1 by default. The exact label may vary as Avaturn updates their UI; look for "Body type", "Avatar type", or "Animatable face".
4. Copy your project's **subdomain** — typically `<project-slug>.avaturn.dev`. The Avaturn portal URL is `https://developer.avaturn.me/<project-slug>` so the slug matches what's in your portal URL.

You only do this once — all subsequent avatars use the same project.

## Step 2: Configure the local exporter

The repo ships a small HTML exporter at `try-3d-avatar/avaturn-exporter.html`. It embeds the Avaturn SDK iframe and auto-downloads the GLB when you click Next/Done in the iframe.

Edit the file and set the `SUBDOMAIN` constant to your project subdomain:

```js
// try-3d-avatar/avaturn-exporter.html, line 18
const SUBDOMAIN = "your-subdomain-here";  // e.g. "mindeaseaau"
```

If the badge at the top of the exporter shows red **"DEMO (T1 likely)"**, you're still on the default `demo` subdomain — fix the constant.

## Step 3: Serve the exporter and create an avatar

```bash
cd try-3d-avatar
python3 -m http.server 8765
# then open http://localhost:8765/avaturn-exporter.html
```

Port choice: `8765` avoids conflicts with the backend (`8000`) and frontend (`3000`). Any free port works.

In the browser:

1. Upload a clear, front-facing selfie. Avaturn's photo-to-3D infers face geometry, skin tone, and proportions from the photo — for East African / Ethiopian personas, use representative photos. **Get model release / permission if using real people.**
2. Customize hair, clothes, glasses. Bedru and Bereket use Avaturn glasses; Dawit and Ashenafi don't. Hair library coverage for natural / coily / locs styles is limited as of 2026-05; pick the closest available short style for males.
3. Click **Next/Done** in the iframe. The GLB downloads to `~/Downloads/avatar-<timestamp>.glb`.
4. To create another, refresh the page and repeat.

## Step 4: Verifying the export is T2

Before wiring the GLB into the picker, **always verify it's T2** — exporting as T1 is the single most common failure mode, and TalkingHead will refuse to load a T1 file. Run:

```bash
python3 - <<'PY' "$HOME/Downloads/avatar-<timestamp>.glb"
import json, struct, sys, os
p = sys.argv[1]
with open(p, "rb") as f:
    f.read(12); cl, _ = struct.unpack("<II", f.read(8))
    g = json.loads(f.read(cl))
names = [m["name"] for m in g["meshes"]]
total = sum(len(m.get("primitives",[{}])[0].get("targets",[])) for m in g["meshes"])
print(f"size:    {os.path.getsize(p)/1024/1024:.1f} MB")
print(f"meshes:  {names}")
print(f"morphs:  {total}")
print(f"verdict: {'T2 ✅ lipsync will work' if 'Head_Mesh' in names else 'T1 ❌ no morphs, WILL NOT lipsync'}")
PY
```

A T2 file shows:
- Size ~10–14 MB
- Meshes including `Body_Mesh`, `Eye_Mesh`, `Head_Mesh`, `Teeth_Mesh`, `Tongue_Mesh`, plus optional `avaturn_hair_*`, `avaturn_glasses_*`, `avaturn_shoes_0`, `avaturn_look_0`
- ~150–200 morph targets total

A T1 file shows:
- Size ~4 MB
- Meshes: `avaturn_body`, `avaturn_hair_0`, `avaturn_shoes_0`, `avaturn_look_0` — **no `Head_Mesh`**
- 0 morph targets

If you got T1, go back to Avaturn's project settings, confirm T2 is enabled, and re-export.

## Step 5: Wire the GLB into the picker

### 5a. Drop the file into the public directory

```bash
mv ~/Downloads/avatar-<timestamp>.glb frontend/public/avatars/<name>.glb
```

Keep filenames lowercase, no spaces — they're served as static URLs.

### 5b. Add a row to `PERSONAS`

In `frontend/src/components/avatar/AvatarScene.tsx`, the `PERSONAS` array drives the picker. Add a row:

```ts
{
  id: "<persona-id>",                // matches i18n keys + URL slugs
  url: "/avatars/<name>.glb",
  body: "M",                          // "F" or "M" — drives idle posture
  geminiVoice: "<VoiceName>",         // see "Adding a new voice" below
  rig: AVATURN_RIG,                   // required for Avaturn-sourced GLBs
}
```

**Always set `rig: AVATURN_RIG` for Avaturn avatars.** The Avaturn skeleton sits slightly different from RPM's — without the retarget, shoulders look hunched. The RPM-sourced `brunette.glb` (Selam) is the only persona that omits `rig`.

### 5c. Add i18n entries

`frontend/src/messages/en.json` — add under `avatar.personas`:

```json
"<persona-id>": {
  "name": "<Display Name>",
  "blurb": "<one-line personality description>",
  "intro": "<2–3 sentence first message, said aloud on play click>"
}
```

`frontend/src/messages/am.json` — same shape, Amharic translation:

```json
"<persona-id>": {
  "name": "<Amharic name in Fidel>",
  "blurb": "<Amharic blurb>",
  "intro": "<Amharic intro>"
}
```

The `intro` text is what gets sent to TTS when the user clicks the play button on a card. Keep it short (~15–25 words) — longer intros sound dragged-out in TTS and increase first-play latency.

### 5d. (If new voice) add the voice name to both ends

The picker preview's TTS now flows through the backend (`POST /api/v1/voice/tts`), so a new voice must be added in two places:

**Frontend** — `frontend/src/lib/gemini-avatar.ts`:

```ts
export const GEMINI_VOICES = [
  // ... existing entries ...
  { id: "<VoiceName>", label: "<VoiceName>", desc: "<short description>" },
] as const;
```

**Backend** — `backend/app/api/v1/voice.py`:

```python
_TTS_VOICES = {
    "Kore", "Aoede", "Charon", "Fenrir", "Puck", "Orus", "Zephyr",
    "Leda", "Algenib", "Iapetus",
    "<VoiceName>",   # add here
}
```

The backend allowlists voices to reject typos / unsupported names with a clear 400 instead of a confusing Gemini error. Gemini Live currently supports ~30 prebuilt voices; the [official voice list](https://ai.google.dev/gemini-api/docs/speech-generation#voices) is the canonical source.

**Gender notes on the classic 8 voices** (matters more than you'd think — voice gender / pitch should match the avatar):

| Voice | Lean | In use by |
|---|---|---|
| Kore | F | Selam (serenity) |
| Aoede | F | Sora (placeholder) |
| Leda | F | unused — available for female personas |
| Zephyr | F | unused; reads feminine despite "bright/breezy" tag |
| Charon | M | Yonas (placeholder) |
| Fenrir | M | Dawit (maya) |
| Orus | M | Ashenafi |
| Puck | M | Bereket (alex) |

Newer V2 voices that read male-leaning (less broadly documented but supported):
- **Algenib** (gravelly) — currently used by Bedru
- **Iapetus** (clear)
- **Algieba** (smooth)
- **Schedar** (even)

If you pick a voice from the V2 set, verify it actually works by running through the picker preview once. If the backend rejects it, add the name to `_TTS_VOICES`.

### 5e. Verify

```bash
cd frontend
npx tsc --noEmit       # type-check
```

You should see no errors related to your changes. (One pre-existing TS error in `AvatarScene.tsx` around line 350 about `requestIdleCallback` is unrelated.)

Then start the dev server (`npm run dev` or `pnpm dev`) and visit `/avatar`. You should see:

- The new persona card appears in the picker grid
- After ~2–3 s a live three.js render captures a thumbnail and freezes into a static PNG (cached in `localStorage`)
- Clicking the play button mounts a mini TalkingHead that speaks the intro with lipsync — fades in over the thumbnail, fades out when done

## Step 6: Test thoroughly

Click each new persona to verify:

1. **Mounts cleanly** — no console errors. If "Blend shapes not found" appears, re-check Step 4.
2. **Lipsync works** — mouth moves in sync with audio. If audio plays but the mouth is frozen, the rig might be missing (`rig: AVATURN_RIG` not set) OR the GLB was actually T1.
3. **Posture is natural** — no hunched shoulders. If shoulders look off, the `rig` is missing or applied wrong.
4. **Switch locales** — toggle UI between English and Amharic. The display name in the picker card should switch (Selam ↔ ሰላም, etc.). When you start a voice call, the avatar should respond in the chosen language.

---

## Architecture reference

For when you need to debug something or understand the moving parts.

### Picker → Viewer flow

| Component | File | Responsibility |
|---|---|---|
| `AvatarScene` | `frontend/src/components/avatar/AvatarScene.tsx` | Owns the `PERSONAS` array; renders the picker grid OR the viewer based on selection state |
| `AvatarPicker` (inline in `AvatarScene`) | same | Card grid, hover prefetch, play preview state |
| `AvatarThumbnail` | `frontend/src/components/avatar/AvatarThumbnail.tsx` | Renders the resting-state PNG snapshot. On cache miss, mounts a live TalkingHead, captures `canvas.toDataURL()`, stores in `localStorage` under `avatar-thumb:v2:<url>` |
| `MiniHead` | `frontend/src/components/avatar/MiniHead.tsx` | The in-card mini TalkingHead that animates while the play preview is active. Plays TTS audio + lipsync via `head.speakAudio()` |
| `AvatarViewer` | `frontend/src/components/avatar/AvatarViewer.tsx` | The full-screen experience after a persona is picked. Streams Gemini Live audio via `BackendVoiceSession`, drives `head.streamAudio()` chunk-by-chunk for low-latency speech |
| `BackendVoiceSession` | `frontend/src/lib/backend-voice.ts` | WebSocket client for `/ws/voice/<conversation_id>` |

### TTS proxy

Picker preview (`fetchTTS`) and Live calls now both route through the backend so the Gemini API key never ships to the browser:

| Endpoint | Purpose | Auth |
|---|---|---|
| `POST /api/v1/voice/tts` | One-shot TTS for picker previews (returns base64 PCM) | Bearer token (must be logged in) |
| `WS /ws/voice/<conversation_id>` | Streaming Gemini Live conversation | Bearer token in query string |
| `POST /api/v1/voice/conversations` | Create / reuse a voice conversation | Bearer token |

Backend config: `GEMINI_API_KEY` must be set in the backend environment. See `.env.example`. The same key powers both the Live WS and the one-shot TTS.

### Bone retarget config (`AVATURN_RIG`)

Lives at the top of `frontend/src/components/avatar/AvatarScene.tsx`. The values come from the upstream TalkingHead repo's [`siteconfig.js`](https://github.com/met4citizen/TalkingHead/blob/main/siteconfig.js) — Avaturn-specific offsets that nudge the spine/neck/shoulders into a natural pose. Don't change unless you're debugging posture issues.

---

## Troubleshooting

### "Avatar failed to load — Blend shapes not found"

The GLB is T1 (no morph targets). Re-export from Avaturn with T2 enabled. See [Step 4](#step-4-verifying-the-export-is-t2).

### "Preview unavailable: Method doesn't allow unregistered callers"

The backend's `GEMINI_API_KEY` is not set. Check `backend/.env` (or wherever your backend env is configured) and confirm `GEMINI_API_KEY` has a value. Restart the backend after setting.

If the key IS set, check that the user is logged in — the `/api/v1/voice/tts` endpoint requires authentication. Guest users will get a 401.

### Picker shows empty space where the thumbnail should be

The first-load thumbnail render failed. Open DevTools → Console. You should see a warning starting with `Thumbnail render failed for <persona-id>:` followed by the actual error.

Common causes:
- TalkingHead's internal `renderer` / `scene` / `camera` field names changed (the lib was updated). Inspect `head` in the console and adjust the property access in `AvatarThumbnail.tsx`.
- Browser ran out of WebGL contexts (more than ~16 simultaneous canvases). Reload.

The cache version is bumped in `AvatarThumbnail.tsx` via `CACHE_VERSION` — change `"v2"` → `"v3"` to invalidate any bad snapshots in users' localStorage.

### Avatar loads but looks hunched / shoulders too high

The Avaturn bone retarget isn't applied. Confirm the `PERSONAS` row for that persona has `rig: AVATURN_RIG`. The RPM `brunette.glb` (Selam) is the only persona that should NOT have this — RPM and Avaturn skeletons have different rest poses.

### Voice gender doesn't match the avatar

You picked the wrong Gemini voice. See the [voice gender table](#5d-if-new-voice-add-the-voice-name-to-both-ends) above.

The TTS audio is cached in memory per `(avatar.id, locale)` for the lifetime of the picker — to force a refresh after swapping voices, hard-reload the page (Cmd-Shift-R).

### File is huge (~14 MB GLB per avatar) — what about repo size?

Each Avaturn T2 GLB is 11–14 MB. With 5 personas, that's ~60 MB of binary in the repo. Acceptable for now (the original RPM `brunette.glb` set the precedent). If this becomes a problem:

1. **Git LFS** — track `*.glb` via Git LFS to keep blobs out of `.git/objects`.
2. **CDN** — serve GLBs from a CDN (Cloudflare R2 / S3 / similar) and reference by absolute URL.
3. **Texture downscale** — Avaturn's default textures are 2048×2048; downscaling to 1024×1024 in Blender cuts GLB size by ~60% with negligible visual loss at the picker thumbnail / viewer scale.

None of these are needed today.

---

## Known limitations / future work

- **Hair library** — Avaturn's hair presets don't include authentic Ethiopian / Habesha styles (locs, traditional braids, fades). Pick the closest neutral style. Custom hair meshes require Blender work.
- **Static PNG thumbnails as a build step** — currently thumbnails are generated client-side on first picker mount. A build-time render (using Puppeteer or headless three.js) would give consistent lighting / angle and eliminate the first-load delay. Not done yet — `AvatarThumbnail.tsx`'s live-render fallback is acceptable.
- **Click-to-play on the thumbnail itself** — currently there's a separate play button on each card. The product brief originally wanted the thumbnail click to start playback. Deferred.
- **Sora & Kai** — the female placeholder and the male placeholder personas remain "coming soon" until their own selfie-based T2 GLBs are exported. They show a "Coming Soon" badge and the play button is disabled.

## Related research

- `thoughts/shared/research/2026-05-26-add-multiple-3d-avatars.md` — full research log including the RPM-shutdown discovery, Avaturn evaluation, and the bone-retarget reverse-engineering
- `docs/research/2026-04-21-therapist-avatar-session-approaches.md` — original architecture survey (predates the RPM shutdown)
