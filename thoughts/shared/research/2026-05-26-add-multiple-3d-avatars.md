---
date: 2026-05-26
researcher: Anatoli
git_commit: 971c283f16b243e5560b345911a9ab1b5650099d
branch: feat/add-multiple-avatars-and-thumbnails
repository: Teklez/MindEase
topic: "Add 4 new 3D avatars (East African personas) with streaming + lipsync, plus picker thumbnails"
tags: [research, avatar, talkinghead, avaturn, ready-player-me, lipsync, gemini-live, thumbnails, personas]
status: complete
last_updated: 2026-05-26
last_updated_by: Anatoli
---

# Research: Add 4 New 3D Avatars (East African Personas) with Streaming + Lipsync

**Date**: 2026-05-26
**Researcher**: Anatoli
**Git Commit**: 971c283f16b243e5560b345911a9ab1b5650099d
**Branch**: feat/add-multiple-avatars-and-thumbnails
**Repository**: github.com/Teklez/MindEase

## Research Question

The codebase has one working 3D avatar (`brunette.glb`, served from `frontend/public/avatars/`) that streams audio and lip-syncs through `@met4citizen/talkinghead` driven by Gemini Live audio chunks. Five persona slots are already wired in `AvatarScene.tsx` (`serenity`, `maya`, `alex`, `sora`, `kai`) but four of them currently point at the same single GLB.

Goal: source **4 additional GLB models** that (a) work with the existing streaming + lipsync pipeline unchanged, (b) read as East African / Ethiopian to match the Amharic localization, and (c) come with PNG thumbnails for the picker cards. Final output is a step-by-step "where to get them and how to wire them in."

## Summary

- **Ready Player Me is dead.** Netflix acquired RPM Dec 2025 and shut down everything (creator, GLB CDN, render API) on Jan 31, 2026. DNS resolution for `readyplayer.me`, `models.readyplayer.me`, `playerzero.readyplayer.me`, `api.readyplayer.me`, `docs.readyplayer.me` all return NXDOMAIN as of 2026-05-26. The existing `brunette.glb` keeps working only because it is bundled as a local static file.
- **The existing `brunette.glb` came from the TalkingHead GitHub repo**, not from a personal RPM avatar. It is one of six demo avatars met4citizen ships at https://github.com/met4citizen/TalkingHead/tree/main/avatars (also: `avatarsdk.glb`, `avaturn.glb`, `mpfb.glb`, `vroid.glb`, `brunette-t.glb`). GLB metadata confirms `"generator":"Ready Player Me","version":"2.0"`. Added in commit `e2a2e35` (2026-04-25) to `try-3d-avatar/`, copied to `frontend/public/avatars/` in commit `3aada61` (2026-05-04). MD5 of both files matches: `e90cde3e9a8659f4471dcf8d602791b6`.
- **Avaturn (`avaturn.me`) is the TalkingHead maintainer's official drop-in RPM replacement** and is alive and well in May 2026 (HTTP 200 on `avaturn.me`, `hub.avaturn.me`, `docs.avaturn.me`). Its demo GLB shipped in the TalkingHead repo (`avaturn.glb`, 13.2 MB) contains **all 15 Oculus visemes** that TalkingHead needs (`viseme_sil`, `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_CH`, `viseme_SS`, `viseme_nn`, `viseme_RR`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`) plus the full 52-shape ARKit set (`eyeBlinkLeft/Right`, `jawOpen`, `mouthClose`, `mouthSmile`, `mouthFrown`, etc.). Drop-in compatible.
- Avaturn is **photo-to-3D**: you upload a selfie of an East African / Ethiopian person and the AI builds the face geometry from it, which means you get authentic features automatically rather than fighting with limited hair/skin presets.
- **One configuration gotcha**: Avaturn's body skeleton is *slightly* different from RPM's, so the TalkingHead maintainer ships a verified `retarget` config in [`siteconfig.js`](https://github.com/met4citizen/TalkingHead/blob/main/siteconfig.js) that nudges shoulder/spine/neck bones. The current `AvatarViewer.tsx` does not pass `retarget` at all — it must be added for Avaturn avatars (no-op for the existing RPM `brunette.glb`).
- **Free tier is fine for non-commercial use.** The TalkingHead README quotes Avaturn: *"It is free for non-commercial use. For commercial use, you must notify the company, and some additional terms apply."* Avaturn's public pricing page lists $800/mo PRO but the free-tier limits are not publicly enumerated. For a thesis/portfolio MindEase, free is fine; for a commercial launch, contact them.
- **Thumbnails: render locally, don't use Avaturn's render API.** Their render API exists but is gated behind a PRO/Enterprise backend token and returns short-lived (15-min) image links — wrong shape for static avatar cards. Best path: a one-time Node/Vite script that loads each GLB, snapshots a headshot via `three` + `gl` (headless WebGL), and writes a static PNG into `frontend/public/avatars/thumbnails/`.

## Detailed Findings

### Current Avatar Pipeline (the part that already works)

**Picker → Viewer split.** `frontend/src/components/avatar/AvatarScene.tsx:45-51` defines 5 personas (`serenity`, `maya`, `alex`, `sora`, `kai`). The picker is a static grid of cards; clicking one mounts `AvatarViewer` (lazy-loaded) and starts the call.

**Avatar mount.** `frontend/src/components/avatar/AvatarViewer.tsx:121-175` constructs a `TalkingHead` instance, calls `head.showAvatar({ url: avatar.url, body: avatar.body, lipsyncLang: 'en', avatarMood: 'neutral' })`, and surfaces progress / errors. After load, it dispatches a resize event and dirties materials so morph attributes recompile.

**Audio streaming + lipsync.** `AvatarViewer.tsx:227-293` exposes `ensureStream`, `pushAudioChunk`, `notifyStreamEnd`:
- `streamStart({ lipsyncType: 'words' }, onAudioStart, onAudioEnd)` initialises an AudioWorklet on first user gesture (`startCall`).
- Each Gemini Live audio chunk is resampled to the audio context rate, fed in via `head.streamAudio({ audio, words, wtimes, wdurations })`, and the worklet glues chunks gap-free.
- Word/timing fallback (`buildLipsyncWords`, `AvatarViewer.tsx:67-77`) generates placeholder syllables proportional to chunk duration when the transcript is non-Latin (Amharic Fidel) — this keeps the mouth moving even without word boundaries.
- `streamNotifyEnd()` is called on `turn_complete` so the worklet drains cleanly.

**The pipeline is avatar-agnostic.** It uses morph-target names (`viseme_aa`, `mouthClose`, `jawOpen`, …) that live inside the GLB; swap the GLB and the same code drives the new avatar's face. No code change needed in the streaming layer for new avatars — only `PERSONAS` URLs + an optional `retarget` config per-source.

### `PERSONAS` Table (Current)

`frontend/src/components/avatar/AvatarScene.tsx:45-51`:

```ts
const PERSONAS: PersonaStatic[] = [
  { id: "serenity", url: "/avatars/brunette.glb", body: "F", geminiVoice: "Kore"   },
  { id: "maya",     url: "/avatars/brunette.glb", body: "F", geminiVoice: "Fenrir" },
  { id: "alex",     url: "/avatars/brunette.glb", body: "F", geminiVoice: "Puck"   },
  { id: "sora",     url: "/avatars/brunette.glb", body: "F", geminiVoice: "Aoede"  },
  { id: "kai",      url: "/avatars/brunette.glb", body: "F", geminiVoice: "Charon" },
];
```

The i18n localizes the names (`frontend/src/messages/en.json` → `avatar.personas`):

| id        | Localized name | Implied gender |
|-----------|----------------|----------------|
| serenity  | Selam          | F              |
| maya      | Dawit          | M              |
| alex      | Henok          | M              |
| sora      | Saba           | F              |
| kai       | Yonas          | M              |

So the new 4 should be **3 male (`maya`/Dawit, `alex`/Henok, `kai`/Yonas) + 1 female (`sora`/Saba)**. The existing female `brunette.glb` stays as `serenity`/Selam.

### Why Ready Player Me Is Not An Option Anymore

Verified directly on 2026-05-26:

```
$ dig +short readyplayer.me models.readyplayer.me playerzero.readyplayer.me api.readyplayer.me docs.readyplayer.me
(all return NO DNS)
```

Curl returns `Exit code 6 — couldn't resolve host` on every endpoint. Public sources confirm the cause and timing:

- [TechCrunch — Netflix acquires Ready Player Me (Dec 19, 2025)](https://techcrunch.com/2025/12/19/netflix-acquires-gaming-avatar-maker-ready-player-me/) — wind-down date Jan 31, 2026, hard shutdown.
- [Ava-Twin migration guide](https://www.ava-twin.me/blog/migrate-ready-player-me-to-ava-twin) — "RPM's API endpoints will go offline. The avatar creator will stop working. GLB hosting will eventually shut down."
- [Genies — RPM Discontinued: Alternatives](https://genies.com/blog/ready-player-me-discontinued-alternatives).

Your existing `brunette.glb` is unaffected because it's a static file in your `public/` dir. But you cannot create new RPM avatars.

### Where `brunette.glb` Actually Came From

`git log -- '*brunette.glb'` shows the file was first added in commit `e2a2e35` (2026-04-25) to `try-3d-avatar/public/brunette.glb`, then duplicated to `frontend/public/avatars/brunette.glb` in commit `3aada61` (2026-05-04). MD5 is identical: `e90cde3e9a8659f4471dcf8d602791b6`.

Curl confirms it is downloadable from the TalkingHead demo repo:

```
$ curl -sI https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/brunette.glb → 200
```

The GitHub Contents API lists all 6 demo avatars in that folder:

| File             | Size      | Source platform      |
|------------------|-----------|----------------------|
| `brunette.glb`   | 4.7 MB    | Ready Player Me      |
| `brunette-t.glb` | 2.9 MB    | RPM (T-pose variant) |
| `avaturn.glb`    | 13.2 MB   | Avaturn              |
| `avatarsdk.glb`  | 12.3 MB   | Avatar SDK           |
| `mpfb.glb`       | 36.8 MB   | MPFB (Blender)       |
| `vroid.glb`      | 2.3 MB    | VRoid Studio         |

These are one-each reference avatars showing the maintainer's supported sources — not a stock of 4+ East-African characters. Useful as **regression tests / verification fixtures**, not as production assets.

### Why Avaturn Is The Pick

**Drop-in compatibility confirmed by inspection of the demo GLB.** The 13.2 MB `avaturn.glb` shipped in the TalkingHead repo, when `strings | grep -E 'viseme_|mouth|jaw|eyeBlink'`'d, contains:

- All 15 Oculus visemes (`viseme_sil`, `viseme_PP`, `viseme_FF`, `viseme_TH`, `viseme_DD`, `viseme_kk`, `viseme_CH`, `viseme_SS`, `viseme_nn`, `viseme_RR`, `viseme_aa`, `viseme_E`, `viseme_I`, `viseme_O`, `viseme_U`)
- ARKit basics (`eyeBlinkLeft/Right`, `jawForward/Left/Open/Right`, `mouthClose/Dimple/Frown/Funnel/Left/Lower/Open/Press/Pucker/Right/Roll/Shrug/Smile/Stretch/Upper`)

Generator string in the GLB metadata: `"Avaturn.me | Blender"`.

**T2 (Type-2) avatars** are the ones with these blendshapes baked in ([docs.avaturn.me/docs/integration/bodies](https://docs.avaturn.me/docs/integration/bodies/)):
- **T1** = static face, no blendshapes → DO NOT USE.
- **T2** = animatable face (ARKit + visemes baked in, separate eyeballs + mouth hole) → use this.
- Body versions `v2023` vs `v2024` — pick **v2024** (standardized skeleton across body shapes).

**Photo-to-3D for authentic features.** Avaturn's primary flow is *upload a selfie → AI builds the face*. For 3 male + 1 female East African / Ethiopian characters, that's a much better path than hunting through limited preset libraries: the face geometry, skin tone, hair colour, and proportions come from real photos. (Avaturn's docs do not enumerate coily/4c hair preset coverage explicitly — uncertain that the hair library has authentic Ethiopian / Habesha braid styles, but the selfie-derived face is the thing that sells the persona.)

**Free for non-commercial.** Per the TalkingHead README quote of Avaturn's policy: *"It is free for non-commercial use. For commercial use, you must notify the company."* Avaturn's [pricing page](https://avaturn.me/pricing/) lists PRO at $800/month for commercial integration. For a thesis / portfolio MindEase, free covers this; for a commercial launch contact Avaturn.

### The Avaturn Bone Retarget (Important)

Avaturn's skeleton sits *slightly* differently from RPM's, so without a retarget the avatar's neck/shoulders look hunched. The maintainer's verified config from `siteconfig.js`:

```js
retarget: {
  Hips:           { y: 0.03 },
  Spine:          { y: 0.02 },
  Spine1:         { y: 0.02, z: 0.01 },
  Spine2:         { y: 0.02, z: 0.01 },
  Neck:           { z: 0.02, y: 0.01 },
  Head:           { z: 0.02 },
  LeftShoulder:   { rx: -0.5 },
  RightShoulder:  { rx: -0.5 },
  scaleToHipsLevel: 1.0,
},
baseline: {
  headRotateX:    -0.05,
  eyeBlinkLeft:    0.15,  // gives Avaturn avatars softer-looking eyes
  eyeBlinkRight:   0.15,
},
```

This needs to be passed into `head.showAvatar(...)` only for Avaturn-sourced GLBs. The existing `brunette.glb` (RPM) needs no retarget. So `PERSONAS` should grow a `source: 'avaturn' | 'rpm'` discriminator, or each persona carries its own `retarget` blob.

### Thumbnails

Avaturn ships a render API ([docs.avaturn.me/docs/integration/api/renders](https://docs.avaturn.me/docs/integration/api/renders/)) but it's PRO-tier and returns 15-min signed URLs — wrong fit for static picker cards.

**Practical thumbnail path:** generate them once locally with a headless three.js script, commit the PNGs to `frontend/public/avatars/thumbnails/`, and reference them by static path on the picker card. The picker card at `AvatarScene.tsx:238-247` currently renders a `<Sparkles>` icon as placeholder — swap that for `<img src={avatar.thumbnail}>` once the PNGs exist.

Two viable thumbnail generators:
- **Manual screenshot from Avaturn's web viewer** — easy, 30 sec per avatar, no code. Open avatar in `hub.avaturn.me`, frame to head/shoulders, snapshot with browser screenshot tool, crop to square in any image editor, save as PNG.
- **Headless three.js render** — a small Node script using `three` + `headless-gl` or `playwright` to load each GLB, position camera to "upper" view, render to a 512×512 PNG. Reusable but ~1 hour of setup. Overkill for 4 avatars; only worth it if more are coming.

For 4 avatars, manual screenshot is the right call.

## Step-by-Step Plan

### Phase 1 — Source the 4 GLB files (~30 minutes)

1. **Gather 4 reference photos.** 3 photos of East African / Ethiopian men (for Dawit, Henok, Yonas) and 1 of a woman (for Saba). Selfies, well-lit, face fully visible, no glasses or heavy hats. Either real friends/colleagues willing to consent OR royalty-free portrait photos from Unsplash / Pexels (search: "Ethiopian portrait", "Habesha man", "East African woman", filter to closeups, verify license).
   - Heads-up: using real identifiable people requires their permission. Unsplash/Pexels portraits are licensed for derivative work but read the specific license per photo; some portrait photographers add model-release caveats.

2. **Create the Avaturn account.** Sign up at https://hub.avaturn.me (account required, no anonymous flow). Free for non-commercial use.

3. **Create avatar #1 (Dawit, M).** Click "Create avatar" → "From photo" → upload the first male photo. Wait ~30 sec for AI face generation. In the Hub UI:
   - **Body type:** Male, **v2024** body version.
   - **Type:** **T2 (animatable)** — this is the critical setting; T1 has no visemes and will NOT work with lipsync.
   - **Hair:** pick the closest available preset. If Avaturn's library lacks authentic Ethiopian hair styles (short curly / fade / locs / braids), pick the closest neutral short hair and accept that the hair is a stylistic compromise — the *face* is the thing that sells the persona.
   - **Clothes:** anything neutral / muted (avoid logos, bright colours that distract from face). The codebase uses `cameraView: 'upper'` so torso is visible but legs are not.
   - **Skin tone:** lock to the photo-derived tone (Avaturn auto-picks; only override if visibly off).

4. **Export as GLB.** Click Download → format `.glb` → confirm T2 / v2024 is selected. File will be ~10–14 MB.

5. **Rename and save.** `dawit.glb` → drop into `frontend/public/avatars/dawit.glb`.

6. **Repeat for #2, #3, #4.**
   - `henok.glb` (M)
   - `yonas.glb` (M)
   - `saba.glb`  (F)

   End state of `frontend/public/avatars/`:
   ```
   brunette.glb    (existing RPM, serenity → Selam)
   dawit.glb       (Avaturn T2 M, maya  → Dawit)
   henok.glb       (Avaturn T2 M, alex  → Henok)
   saba.glb        (Avaturn T2 F, sora  → Saba)
   yonas.glb       (Avaturn T2 M, kai   → Yonas)
   thumbnails/     (created in Phase 3)
   ```

### Phase 2 — Verify lipsync before touching code (~5 min)

Quickly verify the Avaturn export is actually viseme-compatible before integrating:

```bash
strings frontend/public/avatars/dawit.glb \
  | grep -oE 'viseme_[A-Za-z]+' | sort -u
```

You should see exactly these 15 lines:
```
viseme_aa  viseme_CH  viseme_DD  viseme_E   viseme_FF
viseme_I   viseme_kk  viseme_nn  viseme_O   viseme_PP
viseme_RR  viseme_sil viseme_SS  viseme_TH  viseme_U
```

If any are missing → the avatar was exported as T1 (or v2023 with different defaults). Go back to Avaturn Hub and re-export as **T2 / v2024**.

### Phase 3 — Generate 4 thumbnails (~10 min)

Manual path (recommended for 4 avatars):

1. In `hub.avaturn.me`, open each finished avatar.
2. Frame the viewer to head + shoulders (upper view).
3. Browser screenshot → crop to square (512×512 is plenty) → save as PNG.
4. Drop into `frontend/public/avatars/thumbnails/`:
   ```
   selam.png   (use Avaturn's brunette/Selam look or screenshot from current viewer for consistency)
   dawit.png
   henok.png
   saba.png
   yonas.png
   ```

   (Note for `selam.png`: since `brunette.glb` is an RPM avatar and RPM's render API is dead, snapshot from your running `AvatarViewer` — load Selam, screenshot, crop. Or render via three.js. Manual is faster.)

### Phase 4 — Wire the code (~15 min, 4 small edits)

**Edit 1: `frontend/src/components/avatar/types.ts`** — add `thumbnail` + `retarget` fields:

```ts
import type { GeminiVoiceId } from "@/lib/gemini-avatar";

export type AvatarBody = "F" | "M";

// Bone retarget config used when an avatar's source-rig skeleton needs
// nudging. Avaturn-sourced GLBs need this; RPM-sourced ones don't.
export type AvatarRetarget = {
  retarget?: Record<string, { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; scaleToHipsLevel?: number }>;
  baseline?: Record<string, number>;
};

export type AvatarOption = {
  id: string;
  name: string;
  blurb: string;
  intro: string;
  url: string | null;
  thumbnail: string | null;
  body: AvatarBody;
  geminiVoice: GeminiVoiceId;
  retarget?: AvatarRetarget;
};
```

**Edit 2: `frontend/src/components/avatar/AvatarScene.tsx:45-51`** — replace the `PERSONAS` array:

```ts
const AVATURN_RETARGET = {
  retarget: {
    Hips: { y: 0.03 }, Spine: { y: 0.02 },
    Spine1: { y: 0.02, z: 0.01 }, Spine2: { y: 0.02, z: 0.01 },
    Neck: { z: 0.02, y: 0.01 }, Head: { z: 0.02 },
    LeftShoulder: { rx: -0.5 }, RightShoulder: { rx: -0.5 },
    scaleToHipsLevel: 1.0,
  },
  baseline: { headRotateX: -0.05, eyeBlinkLeft: 0.15, eyeBlinkRight: 0.15 },
} as const;

const PERSONAS: PersonaStatic[] = [
  // serenity (Selam) — RPM, no retarget
  { id: "serenity", url: "/avatars/brunette.glb", thumbnail: "/avatars/thumbnails/selam.png", body: "F", geminiVoice: "Kore"   },
  // maya (Dawit) — Avaturn M
  { id: "maya",     url: "/avatars/dawit.glb",    thumbnail: "/avatars/thumbnails/dawit.png", body: "M", geminiVoice: "Fenrir", retarget: AVATURN_RETARGET },
  // alex (Henok) — Avaturn M
  { id: "alex",     url: "/avatars/henok.glb",    thumbnail: "/avatars/thumbnails/henok.png", body: "M", geminiVoice: "Puck",   retarget: AVATURN_RETARGET },
  // sora (Saba) — Avaturn F
  { id: "sora",     url: "/avatars/saba.glb",     thumbnail: "/avatars/thumbnails/saba.png",  body: "F", geminiVoice: "Aoede",  retarget: AVATURN_RETARGET },
  // kai (Yonas) — Avaturn M
  { id: "kai",      url: "/avatars/yonas.glb",    thumbnail: "/avatars/thumbnails/yonas.png", body: "M", geminiVoice: "Charon", retarget: AVATURN_RETARGET },
];
```

Also update `PersonaStatic` (same file, type definition near line 38):

```ts
type PersonaStatic = {
  id: string;
  url: string | null;
  thumbnail: string | null;
  body: AvatarBody;
  geminiVoice: GeminiVoiceId;
  retarget?: AvatarRetarget;
};
```

And `useLocalizedAvatars` (`AvatarScene.tsx:53-65`) passes `thumbnail` and `retarget` through to the `AvatarOption` it returns — add those two fields to the spread.

**Edit 3: `frontend/src/components/avatar/AvatarViewer.tsx:142-149`** — pass retarget + baseline into `showAvatar`:

```ts
head
  .showAvatar(
    {
      url: avatar.url,
      body: avatar.body,
      lipsyncLang: "en",
      avatarMood: "neutral",
      ...(avatar.retarget?.retarget ? { retarget: avatar.retarget.retarget } : {}),
      ...(avatar.retarget?.baseline ? { baseline: avatar.retarget.baseline } : {}),
    },
    (ev: ProgressEvent) => { /* … unchanged … */ },
  )
```

The `talkinghead.d.ts` shim at `try-3d-avatar/src/talkinghead.d.ts:4-7` types `showAvatar`'s first arg as `Record<string, unknown>`-ish — no change needed there. If the production frontend has its own copy of this shim, mirror the change.

**Edit 4: `frontend/src/components/avatar/AvatarScene.tsx:238-247`** — replace the `Sparkles` placeholder in the picker card with a real image:

```tsx
<div className="relative mb-4 flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-muted to-muted/40">
  {a.thumbnail ? (
    <img
      src={a.thumbnail}
      alt={a.name}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : (
    <Sparkles className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.25} />
  )}
  {/* … existing "coming soon" badge + play button unchanged … */}
</div>
```

Keep the existing `Sparkles` import as fallback — if a thumbnail ever fails to load or a future persona ships without one, the placeholder still works.

### Phase 5 — Manual QA (~10 min)

1. `cd frontend && pnpm dev` (or `npm run dev`).
2. Open `/avatar`. Picker should show 5 cards with thumbnails (not placeholder).
3. Click **Dawit** → viewer loads → start call → talk → confirm:
   - Avatar loads (progress bar to 100%, then ready).
   - Posture looks correct — no hunched shoulders (proves retarget applied).
   - Audio plays.
   - Lips move in sync with audio (proves visemes wired).
4. Repeat for **Henok**, **Saba**, **Yonas**.
5. Go back, click **Selam** (the existing RPM avatar). Confirm it still works — i.e., the new `retarget` plumbing didn't break the no-retarget path.
6. Switch UI locale to Amharic. Confirm names render as Selam/Dawit/Henok/Saba/Yonas and the Amharic fallback lipsync (`buildLipsyncWords` at `AvatarViewer.tsx:67-77`) still drives mouth movement.

### Phase 6 — Commit

```
feat(avatar): add 4 Avaturn-sourced personas with thumbnails

- New GLBs: dawit, henok, saba, yonas (Avaturn T2/v2024)
- PERSONAS now spans 5 distinct models matched to localised names
- Picker cards show PNG thumbnails (Sparkles kept as fallback)
- Avaturn skeletons need a bone retarget; passed through showAvatar
- Existing brunette.glb (Selam) unchanged
```

## Code References

- `frontend/src/components/avatar/AvatarScene.tsx:45-51` — `PERSONAS` array (the table to update)
- `frontend/src/components/avatar/AvatarScene.tsx:53-65` — `useLocalizedAvatars` (passes static fields into the localized `AvatarOption`)
- `frontend/src/components/avatar/AvatarScene.tsx:238-272` — picker card markup (the `Sparkles` placeholder lives here)
- `frontend/src/components/avatar/AvatarViewer.tsx:121-175` — TalkingHead constructor + `showAvatar` call (where `retarget` must be plumbed)
- `frontend/src/components/avatar/AvatarViewer.tsx:227-293` — streaming + lipsync pipeline (unchanged; avatar-agnostic)
- `frontend/src/components/avatar/types.ts:1-13` — type definitions (extend `AvatarOption` with `thumbnail` + `retarget`)
- `frontend/src/messages/en.json` → `avatar.personas` — localized names (already populated; no edit needed)
- `frontend/src/messages/am.json` → `avatar.personas` — Amharic localized names (already populated)
- `frontend/public/avatars/brunette.glb` — existing RPM model (MD5 `e90cde3e9a8659f4471dcf8d602791b6`)
- `try-3d-avatar/src/AvatarScene.tsx` — sandbox version (do not edit, kept for reference)
- `try-3d-avatar/src/talkinghead.d.ts` — TS shim for `@met4citizen/talkinghead`

## Architecture Documentation

The avatar feature decomposes into three layers:

- **Picker** (`AvatarScene.tsx`) — static, data-driven grid. The `PERSONAS` array is the single source of truth for which avatars exist; everything else (i18n, picker, viewer) keys off persona `id`.
- **Viewer** (`AvatarViewer.tsx`) — lazy-loaded, owns the TalkingHead instance, audio worklet, and the BackendVoiceSession lifecycle. Receives an `AvatarOption` and a `continueConversationId`; everything else is internal state.
- **Lipsync engine** — `LipsyncEn` from `@met4citizen/talkinghead/modules/lipsync-en.mjs`, statically imported to dodge Next.js's dynamic-import-from-node_modules-subpath limitation (`AvatarViewer.tsx:6` + `:136`). For Amharic input, `romanizeForLipsync` (`AvatarViewer.tsx:43-62`) converts Fidel codepoints to Latin syllables so `LipsyncEn` can still drive visemes; the actual sound doesn't matter, only the vowel/consonant pattern.

Per-source idiosyncrasies (e.g., Avaturn's bone retarget) belong in the `PERSONAS` row, not in `AvatarViewer`. That keeps the viewer's mount effect (`AvatarViewer.tsx:121-223`) avatar-source-agnostic — add a new source platform later by adding a row with its own `retarget` and the viewer code stays untouched.

## Historical Context (from docs/)

- `docs/research/2026-04-21-therapist-avatar-session-approaches.md:142-191` — original survey that landed on TalkingHead + Ready Player Me. Documents the requirement for ARKit + Oculus visemes on the GLB. (Pre-RPM-shutdown.)
- `docs/research/2026-03-16-sds-implementation-status.md` — SDS implementation tracker (avatar section pre-implementation).
- `docs/plans/2026-05-14-rag-phase-3-voice-backend.md` — phase 3 of the voice backend (BackendVoiceSession), which the new avatars inherit unchanged.

## Open Questions

- **Avaturn commercial terms for MindEase specifically.** If MindEase ever becomes a paid product, contact `business@avaturn.me` and either subscribe ($800/mo PRO is the published tier) or renegotiate. For research / thesis / portfolio purposes, the free non-commercial tier is fine.
- **Hair authenticity.** Avaturn's hair library coverage for Ethiopian / Habesha styles (short curly fade, locs, traditional braids) is not publicly documented. Plan B if their preset library is sparse: pick the neutralest short-hair preset for males and a tied-back / bun preset for females, and accept that the hair is a stylistic compromise. Adding custom hair meshes is a Blender task, not an Avaturn one.
- **Crisis avatar.** If a 6th "crisis-companion" persona is ever needed (warm female reading a safety script), it can be added later as another Avaturn row without touching streaming code.
- **Click-to-talk thumbnail preview** (deferred, per user). The existing `AvatarScene.tsx:97-185` already has a `playPreview` function that fetches TTS for the avatar's intro and plays it locally on card click — that's the existing "play button" behaviour. The user wants to extend this so the card thumbnail itself becomes the play affordance. Not part of this task — separate ticket.
- **Future-proofing the source.** If Avaturn ever follows RPM's fate, the next candidate is **Avatar SDK / MetaPerson** (confirmed Oculus visemes per [docs.metaperson.avatarsdk.com/lipsync](https://docs.metaperson.avatarsdk.com/lipsync/), but $300+/mo with no free tier and requires two Blender preprocessing scripts from `met4citizen/TalkingHead/blender/`). Avoid Ava-Twin (Unity WebGL focused, not GLB). MPFB / VRoid / RocketBox are free but each needs half-day-per-avatar Blender rigging work.

## Sources

- [@met4citizen/TalkingHead README](https://github.com/met4citizen/TalkingHead/blob/main/README.md)
- [TalkingHead siteconfig.js — verified Avaturn retarget config](https://github.com/met4citizen/TalkingHead/blob/main/siteconfig.js)
- [TalkingHead /avatars/ — demo GLBs (incl. brunette.glb)](https://github.com/met4citizen/TalkingHead/tree/main/avatars)
- [TalkingHead Issue #169 — community discussion of post-RPM options](https://github.com/met4citizen/TalkingHead/issues/169)
- [Avaturn homepage](https://avaturn.me/)
- [Avaturn Hub (where users create avatars)](https://hub.avaturn.me/)
- [Avaturn docs — T1 vs T2 bodies](https://docs.avaturn.me/docs/integration/bodies/)
- [Avaturn docs — Renders API (PRO only)](https://docs.avaturn.me/docs/integration/api/renders/)
- [Avaturn pricing](https://avaturn.me/pricing/)
- [TechCrunch — Netflix acquires Ready Player Me (Dec 19, 2025)](https://techcrunch.com/2025/12/19/netflix-acquires-gaming-avatar-maker-ready-player-me/)
- [Ava-Twin RPM migration guide](https://www.ava-twin.me/blog/migrate-ready-player-me-to-ava-twin)
- [Genies — Ready Player Me Discontinued: 5 Alternatives](https://genies.com/blog/ready-player-me-discontinued-alternatives)
- [Avatar SDK MetaPerson — Oculus visemes confirmed](https://docs.metaperson.avatarsdk.com/lipsync/)
