# Avatars

The picker (`AvatarThumbnail`) renders a snapshot of each `.glb` via three.js the
first time the user visits, then caches it in `localStorage`. That cold-load
snapshot takes ~2–3 seconds across all five avatars even with the
concurrency-2 render queue.

For an **instant** cold load, drop a static portrait next to each `.glb` and
the picker will skip the live render entirely:

```
ashenafi.glb  -> ashenafi.webp  (preferred)
ashenafi.glb  -> ashenafi.png   (also probed)
```

Recommended specs: 512×512, head-and-shoulders framing, transparent or muted
background to match the card gradient. WebP at quality 85 lands around 30–60
KB per portrait. Anything that loads as an `<img>` works.

The probe is silent — missing files just fall through to the live render, so
you can roll these out one persona at a time.
