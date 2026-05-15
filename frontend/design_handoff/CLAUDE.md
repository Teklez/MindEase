# CLAUDE.md — MindEase Group Room

You are porting the redesigned **inside-a-circle** experience into the existing `frontend/` Next.js codebase. This file is scoped to **/groups/[groupId]** only — the page members land on when they click into a specific circle.

---

## Reference file

- `GroupRoom.html` — high-fidelity mockup of a single group room. Open in a browser.

## Inspiration

Blend of **Discord** (left channel rail · right member presence column · persistent composer) and **Reddit** (post-anatomy: title + body + reactions + tags + threaded replies + pinned/sort tabs), softened for mental-health context.

Critical adaptations from those references:
- **No upvotes/downvotes.** Voting is toxic for mental-health peer spaces. Replace with **empathy reactions**: "Felt this", "Holding space", "Lighting a candle", "Quiet applause", "So glad for you". Each is a small pill with emoji + label + count.
- **Anonymous post toggle** is first-class (Discord doesn't have this; Reddit's throwaway accounts are clunky). Authors can post anonymously; their avatar becomes a dashed-outline `?` glyph and name shows as "Anonymous member".
- **CW (content-warning) tags** on posts that mention panic, self-harm risk, grief, etc. Render as a clay-tinted pill in the post header.
- **Daily prompt cards** seed the room daily — a special post-type that asks one question, with "Answer the prompt" CTA + "Skip today".
- **Moderator badges** are honey-tinted; mod replies pin a small "Mod" tag next to the name.

## Target files

- `frontend/src/app/(main)/groups/[groupId]/page.tsx` — rewrite
- New layout: `frontend/src/app/(main)/groups/[groupId]/layout.tsx` — sidebar shell
- New components under `src/components/groups/room/`:
  - `RoomShell.tsx` — 3-column grid (channels rail | feed | members rail)
  - `ChannelsRail.tsx` — left rail (group identity card + room list + events)
  - `MembersRail.tsx` — right rail (search + grouped presence list + about-card)
  - `RoomHeader.tsx` — top bar inside feed column (# room name + topic + actions)
  - `RoomTabs.tsx` — Posts / Pinned / Resources / Events
  - `SortRow.tsx` — Active / New / Most cared for / Most replies
  - `PinnedBanner.tsx` — honey-accented banner with mod-pinned info
  - `DailyPromptCard.tsx` — dawn-tinted prompt-of-the-day
  - `Post.tsx` — main post anatomy
  - `ReactionRow.tsx` — empathy reactions + action buttons
  - `RepliesPreview.tsx` — collapsed thread teaser
  - `ThreadInline.tsx` — expanded thread with replies + inline composer
  - `PostComposer.tsx` — sticky bottom composer (title + body + tags + anon toggle)
- Existing `src/components/groups/GroupCard.tsx`, `GroupInfoSheet.tsx`, etc. remain for the parent listing page (Groups.html handoff).

## Stack

- Next.js 14 App Router + TypeScript
- Tailwind v3 with sage palette + honey/dawn tints (assume Groups handoff is applied — those tokens exist)
- shadcn/ui (new-york)
- lucide-react
- next-intl
- WebSocket via existing `useWebSocket.ts` (extend with group/room channel)

## Prerequisites

- Landing palette tokens are in place
- Groups listing handoff has been applied (adds `--honey`, `--dawn` tokens)
- If `--honey` is missing, **stop and ask** the user to confirm Groups listing port is complete

---

## Step 1 — Route + layout shell

```tsx
// app/(main)/groups/[groupId]/layout.tsx
export default async function GroupRoomLayout({ children, params }: { children: React.ReactNode; params: { groupId: string }; }) {
  const group = await getGroup(params.groupId);
  if (!group) notFound();
  return (
    <GroupContextProvider group={group}>
      <div className="grid grid-cols-[268px_1fr_296px] h-[calc(100vh-60px)] min-h-0">
        <ChannelsRail />
        <main className="flex flex-col min-w-0 bg-secondary/30 overflow-hidden">{children}</main>
        <MembersRail />
      </div>
    </GroupContextProvider>
  );
}
```

`h-[calc(100vh-60px)]` accounts for the global TopNav. The two rails are sticky within the layout.

Below `lg:` collapse:
- **Below 1280px**: hide the right (members) rail, expose as a `<Sheet>` opened from the header "Members" button.
- **Below 1024px**: hide the left (channels) rail too, expose as a `<Sheet>` opened from a hamburger in `RoomHeader`.

`page.tsx` itself renders only the feed:
```tsx
// app/(main)/groups/[groupId]/page.tsx
export default function GroupRoomPage({ searchParams }: { searchParams: { room?: string; tab?: "posts" | "pinned" | "resources" | "events" }; }) {
  return (
    <>
      <RoomHeader />
      <RoomTabs />
      <SortRow />
      <Feed />
      <PostComposer />
    </>
  );
}
```

URL-as-state: active room is `?room={slug}`, active tab is `?tab=posts|pinned|resources|events`, sort is `?sort=active|new|empathy|replies`. Default room is `daily-check-in`, default tab `posts`, default sort `active`.

---

## Step 2 — `<ChannelsRail />` (left rail, 268px)

Vertical flex column. From top to bottom:

1. **Header** (`p-5 pb-3 border-b`): "← Back to circles" mono link, then a circle identity row — 38px rounded-square icon (sage-soft bg, leaf glyph) + circle title (serif, 16px) + sub-line (mono caps): live pulse dot + "{n} online · {n} members".

2. **Info pills row** (`px-4 py-3 border-b flex gap-1.5`): three equal pills (Members count, Online count, Next event time). Each is `bg-secondary/50 border rounded-sm`, serif numeric value + mono caps label.

3. **Rooms section** (`px-2 pt-3.5 flex flex-col gap-px`):
   - Section header (mono caps "Rooms") with a `+` icon button on the right (opens "Create room" dialog — mods only).
   - Room items: `<RoomItem name="daily-check-in" active unread count={142} />`
   - Item layout: `px-3 py-1.5 rounded-md` flex with a mono `#` glyph + name + right-side count pill or unread dot.
   - States:
     - Default: `text-foreground/85`, no bg
     - Hover: `bg-secondary/50`
     - Active: `bg-primary-soft text-primary-deep font-medium`, count pill becomes solid
     - Unread (not active): bold weight, 2px sage left-edge indicator (`before:content-[''] before:absolute before:left-0 before:top-3.5 before:bottom-3.5 before:w-0.5 before:bg-primary before:rounded-r`)
   - Special room: private rooms get a `<Lock>` icon instead of `#`.

4. **Events section** (same shape): clock icon items showing upcoming events with a small "Tonight" / "Fri" pill on the right.

5. **Events promo card** (`mx-3 mt-3.5 p-3.5 rounded-md bg-gradient-to-b from-primary-soft to-secondary/40 border`): sage glow blob, mono eyebrow "— Starting in 4h", serif title "Quiet Hour tonight", sub-copy, mono CTA "RSVP →".

6. **Foot** (sticky bottom, `border-t p-2.5 bg-background flex items-center gap-2`): user avatar with online dot, name, status line ("Online · feeling steady"), settings cog button.

Avatar online indicator: 9px dot, bottom-right of avatar, `bg-online` (`oklch(0.62 0.13 145)`), 2px solid bg-background border.

---

## Step 3 — `<RoomHeader />` (feed column)

```tsx
<header className="bg-background border-b py-3.5 px-7 flex items-center justify-between gap-4">
  <div className="flex items-center gap-3.5 min-w-0">
    <span className="font-mono text-lg text-foreground/40">#</span>
    <h2 className="font-serif text-lg font-medium tracking-tight">daily-check-in</h2>
    <span className="text-sm text-muted-foreground border-l border-border pl-3.5 truncate max-w-[40ch]">
      A soft place to land each day. One sentence. One face. No pressure.
    </span>
  </div>
  <div className="flex items-center gap-1.5 shrink-0">
    <IconButton title="Pin"><Pin /></IconButton>
    <IconButton title="Members" onClick={openMembersSheet}><Users /></IconButton>
    <IconButton title="More"><MoreVertical /></IconButton>
  </div>
</header>
```

The `IconButton` is a 34px circle, `bg-secondary/50 border border-border rounded-full grid place-items-center text-foreground/70 hover:bg-background hover:text-foreground`.

---

## Step 4 — `<RoomTabs />` and `<SortRow />`

**Tabs** (under-bordered, sage active accent):
- Posts (with count badge)
- Pinned (with count)
- Resources
- Events

`py-3 px-7 border-b bg-background`. Each tab `px-4.5 py-3 text-sm font-medium border-b-2 -mb-px`. Inactive: `border-transparent text-muted-foreground`. Active: `border-primary text-foreground`. Count badge inside tab: `font-mono text-[10px] bg-secondary border rounded-full px-1.5 py-px ml-2`; on active tab the badge becomes `bg-primary-soft text-primary-deep border-transparent`.

**Sort row** (`px-7 pt-3.5 pb-1.5 flex items-center gap-3.5 flex-wrap`):
- 4 sort buttons: Active, New, Most cared for, Most replies. Each `bg-background border rounded-sm px-2.5 py-1 text-[12.5px] font-medium`. Active button = `bg-foreground text-background border-foreground`.
- Right side: mono caps "Filtering · **Last 7 days**" (clicking opens a date range picker, future).

---

## Step 5 — `<Feed />`

Scrollable region, `flex-1 overflow-y-auto px-7 py-4 pb-10 flex flex-col gap-3.5`.

Rendering order:
1. `<PinnedBanner />` (only if any pins for this room)
2. `<DailyPromptCard />` (only for the `daily-check-in` room, once per day)
3. Posts in selected sort order — each `<Post />`

Use react-virtual for the post list if rooms get large; for v1 a plain `.map()` is fine. Add intersection-observer "load more" sentinel at the bottom (page size 25).

### `<PinnedBanner />`

```tsx
<div className="relative bg-background border rounded-md py-3.5 px-4.5 grid grid-cols-[auto_1fr_auto] gap-3.5 items-start before:content-[''] before:absolute before:left-0 before:top-3.5 before:bottom-3.5 before:w-0.5 before:bg-honey before:rounded-r">
  <div className="w-8 h-8 rounded-full bg-honey-soft text-honey-deep grid place-items-center shrink-0"><Pin /></div>
  <div>
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">— Pinned by {mod.name} (moderator)</p>
    <p className="font-serif text-[15.5px] font-medium leading-snug">{pin.title}</p>
    <p className="text-[12.5px] text-muted-foreground mt-1">{pin.summary}</p>
  </div>
  <Link href={pin.href} className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-primary-deep flex items-center gap-1.5 self-center">Open <ArrowRight className="h-3 w-3" /></Link>
</div>
```

### `<DailyPromptCard />`

Special card with a dawn-tinted gradient + blur blob. Renders only in `#daily-check-in`. Contents:
- Mono eyebrow "Today's prompt · {weekday}"
- Serif h3 (24px, weight 360) — prompt question with one italic word
- Sub-line muted
- Action row: primary "Answer the prompt" button (opens composer pre-filled with the prompt context), ghost "Skip today" button, right-side mono meta "{n} answered today"

Server-side: fetch today's prompt from `/api/groups/{id}/daily-prompt` (one per group per day, set by moderators or auto-generated). Skip the card if user has already answered today.

---

## Step 6 — `<Post />` anatomy

Grid layout: `[author-col 42px] [body 1fr]`, `gap-3.5`.

```tsx
<article className={cn(
  "bg-background border rounded-md py-4 px-4.5 transition-colors",
  "hover:border-border-strong",
  post.featured && "bg-primary-soft border-primary/25"
)}>
  <div className="grid grid-cols-[42px_1fr] gap-3.5">
    <div className="flex flex-col items-center gap-1.5">
      <Avatar src={post.anonymous ? undefined : author.avatarUrl} fallback={post.anonymous ? "?" : author.initials} className={cn("h-9 w-9", post.anonymous && "border-dashed bg-secondary text-muted-foreground")} />
      {author.role === "mod" && <span className="role-pill mod">Mod</span>}
      {author.role === "member" && !post.anonymous && <span className="role-pill">Member</span>}
    </div>
    <div className="min-w-0">
      <PostHead post={post} />
      {post.title && <h3 className="font-serif text-[19px] font-medium tracking-tight leading-snug mt-1.5 mb-1.5">{post.title}</h3>}
      <PostBody post={post} />
      <ReactionRow post={post} />
      {post.threadOpen ? <ThreadInline post={post} /> : <RepliesPreview post={post} />}
    </div>
  </div>
</article>
```

**`<PostHead />`** — mono caps row: author name (bold sans, 13px) · dot · relative time · dot · room slug · tag pills (CW / Win / Question / Resource).

CW tag color: `bg-clay-soft text-clay-deep` with an alert icon.
Win tag: `bg-primary-soft text-primary-deep` with a star icon.

**`<PostBody />`** — markdown-rendered text via `react-markdown` (already a common pattern; if not installed, use a simple paragraph mapper). Supports bold/italic, blockquotes, links, single-line code, images (lazy-loaded, `max-h-[220px] rounded-sm`). Block-quote style: left sage-soft 2px border, italic serif, muted text.

Anonymous author: name renders as "Anonymous member"; clicking the avatar does nothing (no profile to open). DO NOT reveal the underlying user to anyone except moderators via a guarded backend endpoint.

---

## Step 7 — `<ReactionRow />` and empathy reactions

```tsx
<div className="mt-3 flex items-center gap-1.5 flex-wrap">
  {EMPATHY_REACTIONS.map((r) => (
    <ReactionPill key={r.key} reaction={r} active={post.myReactions.includes(r.key)} count={post.reactionCounts[r.key] ?? 0} onClick={() => toggleReaction(post.id, r.key)} />
  ))}
  <button className="react-more" onClick={openReactionPicker}><Plus className="h-3.5 w-3.5" /></button>
  <div className="ml-auto flex items-center gap-1">
    <button className="action" onClick={toggleThread}><MessageSquare className="h-3.5 w-3.5" />Reply</button>
    <button className="action" onClick={savePost}><Bookmark className="h-3.5 w-3.5" />Save</button>
    <button className="action" onClick={openPostMenu}><MoreHorizontal className="h-3.5 w-3.5" /></button>
  </div>
</div>
```

**Empathy reactions taxonomy** (`src/lib/empathy.ts`):

```ts
export const EMPATHY_REACTIONS = [
  { key: "felt", emoji: "🌿", label: "Felt this" },
  { key: "holding", emoji: "🤝", label: "Holding space" },
  { key: "candle", emoji: "🕯️", label: "Lighting a candle" },
  { key: "glad", emoji: "✨", label: "So glad for you" },
  { key: "applause", emoji: "👏", label: "Quiet applause" },
];
```

Render only the 3–5 reactions that have counts > 0 by default; show all available via the `+` button. Toggle is optimistic (existing reaction-toggle API pattern from `useGroups`).

**Pill style:**
- Default: `bg-secondary/50 border rounded-full px-2.5 py-1 text-[12.5px] font-medium text-foreground/85` + small lift on hover
- Active (user has reacted): `bg-primary-soft border-primary/30 text-primary-deep`
- Inside: emoji span (size 13px line-none) + label + mono count

DO NOT add aggregate scores ("net empathy", "rank"). Each reaction is independent.

---

## Step 8 — `<RepliesPreview />` and `<ThreadInline />`

**Collapsed (`<RepliesPreview />`):**
```tsx
<div className="mt-2.5 pt-2.5 border-t border-secondary flex items-center gap-2.5">
  <div className="flex"><Avatar />...</div>  {/* up to 3 stacked replier avatars */}
  <p className="text-[12.5px] text-muted-foreground min-w-0 flex-1 truncate">
    <b className="text-foreground font-medium">{replyCount} replies</b> · latest from {latestReply.author} <span className="font-serif italic text-foreground/85">&ldquo;{latestReply.excerpt}&rdquo;</span>
  </p>
  <button onClick={openThread} className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-primary-deep flex items-center gap-1">Open thread <ArrowRight className="h-3 w-3" /></button>
</div>
```

**Expanded (`<ThreadInline />`):**

Show all replies inline (or top 5 with a "show more"), then a reply composer at the bottom.

Each reply: grid `[30px avatar][1fr body]`, gap-2.5. Body has a mono caps name row, then 13.5px reply text, then action row (clay heart with count + Reply button).

The inline reply composer is a flat input pill with a sage send button on the right — instant send (no title field). For longer replies, expand to the full composer in a side drawer.

---

## Step 9 — `<PostComposer />` (sticky bottom)

```tsx
<div className="bg-background border-t pt-3.5 pb-4.5 px-7">
  <div className="max-w-[780px] mx-auto bg-background border border-border-strong rounded-md p-3 transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_12%,transparent)]">
    <div className="flex items-center gap-2 pb-2 border-b border-secondary flex-wrap">
      <input className="composer-title" placeholder="Give your check-in a soft title…" />
      <TagRow tags={post.tags} onChange={setTags} />
    </div>
    <textarea placeholder="Take your time. Say only what feels true. You can edit or delete this anytime." />
    <div className="flex items-center gap-1.5 pt-1.5 border-t border-secondary">
      <Tool icon={<Smile />} title="Mood tag" />
      <Tool icon={<Image />} title="Add image" />
      <Tool icon={<Paperclip />} title="Attach" />
      <Tool icon={<AlertTriangle />} title="Add CW" />
      <AnonToggle value={anon} onChange={setAnon} />
      <button className="ml-auto bg-foreground text-background px-4 py-2 rounded-sm text-[13px] font-medium hover:bg-primary-deep">
        Share <ArrowRight className="inline h-3.5 w-3.5" />
      </button>
    </div>
  </div>
  <div className="max-w-[780px] mx-auto mt-2 flex justify-between font-mono text-[10.5px] tracking-wide text-muted-foreground">
    <span className="text-primary-deep flex items-center gap-1.5">
      <CircleDot className="h-3 w-3" /> Moderated by {moderator.name} · calm rules apply
    </span>
    <span>⌘⏎ to post · ⇧⏎ new line</span>
  </div>
</div>
```

**Behaviors:**
- Title input: serif font, 16px, italic placeholder. Optional; if empty, post is body-only.
- Body textarea: auto-grow up to 8 rows.
- Tag row: shows current room slug as a default sage pill; "+ tag" opens a tag picker with the room's allowed tags (CW, Win, Question, Resource, etc.).
- Anonymous toggle: small inline pill with a switch graphic. When on, the post author becomes anonymous (`anonymous: true` on the API payload). Show a brief tooltip on first toggle: "Your name won't appear, but moderators can still reach you if rules need enforcing."
- ⌘⏎ submits, ⇧⏎ newline, Enter alone adds newline (different from chat composer — posts are longer, so we lean on Cmd+Enter).
- Disable submit while empty or while posting.

**Daily-prompt prefill:** when the user clicks "Answer the prompt" in `<DailyPromptCard />`, focus the composer and prefill the title with the prompt's short label and seed a Markdown blockquote of the prompt in the body. The prompt's ID gets attached to the post payload (so the backend can group "today's responses").

---

## Step 10 — `<MembersRail />` (right rail, 296px)

Top header: serif "Members" + mono caps sub: live dot + "{n} online · {n} total".

Search input below (32px, `bg-secondary/50 border rounded-sm`, "Find a member…" placeholder). Debounce 200ms client-side.

Below: grouped list with mono caps section headers:
- **Moderators** ({count})
- **Online** ({count})
- **Idle** ({count})
- **Offline** ({count})

Member row: `[avatar][name + status][optional vibe emoji]`, `px-3 py-1.5 rounded-md` flex. Hover: `bg-secondary/50`. The current user's row: `bg-primary-soft text-primary-deep` with "(you)" suffix on the name. Moderator row: small honey "Mod" badge after the name.

Avatar status indicator:
- Online: `bg-online` (sage-green) dot, 9px, 2px solid bg-background border
- Idle: `bg-idle` (honey) dot
- Offline: `bg-foreground/50` dot (no glow)

Click a member → opens a small popover with their profile snippet + "Message privately" CTA (uses existing 1-on-1 chat scaffolding) + "Mute their posts" (mute, not block — preserves "I don't want to silence them everywhere" boundary).

At the bottom of the rail: an "About this circle" mini-card (mono caps header + description sentence + linked "Read the charter"). Pulls from `group.about_short`.

---

## Step 11 — Realtime + data

Extend `useWebSocket.ts` with a `room` channel:

```ts
useGroupRoom(groupId, roomSlug) => {
  posts, addPost, addReply, toggleReaction,
  members, memberPresence,
  typing,
  connectionStatus,
}
```

Events from server:
- `post.created` — append/replace by ID (optimistic update reconciliation)
- `post.updated` — patch
- `reply.created` — append to thread
- `reaction.changed` — update reaction count for a post
- `presence.update` — member status changed
- `typing` — member is typing in this room (drives "Typing…" indicator under the mod name in the right rail)

For v1 if WebSocket isn't wired for rooms yet, fall back to polling with `swr` (5s focus interval). Mark this clearly in code comments so it can be upgraded.

Existing `useGroups` joinGroup / leaveGroup remains the source of truth for membership. If the current user isn't a member, the feed renders a join-gate state ("Join to read and reply" centered card) instead of the composer.

---

## Step 12 — i18n keys (`groups.room.*`)

```json
"groups": {
  "room": {
    "back": "Back to circles",
    "online": "{n} online",
    "members": "{n} members",
    "rooms": "Rooms",
    "events": "Events",
    "rsvp": "RSVP →",
    "tabs": { "posts": "Posts", "pinned": "Pinned", "resources": "Resources", "events": "Events" },
    "sort": {
      "active": "Active",
      "new": "New",
      "empathy": "Most cared for",
      "replies": "Most replies",
      "filterLabel": "Filtering · <b>{range}</b>"
    },
    "pinned": {
      "byMod": "— Pinned by {name} (moderator)",
      "open": "Open"
    },
    "prompt": {
      "today": "Today's prompt · {weekday}",
      "answer": "Answer the prompt",
      "skip": "Skip today",
      "answered": "{n} answered today"
    },
    "composer": {
      "titlePlaceholder": "Give your check-in a soft title…",
      "bodyPlaceholder": "Take your time. Say only what feels true. You can edit or delete this anytime.",
      "anon": "Anonymous",
      "anonTooltip": "Your name won't appear, but moderators can still reach you if rules need enforcing.",
      "share": "Share",
      "moderatedBy": "Moderated by {name} · calm rules apply",
      "hint": "⌘⏎ to post · ⇧⏎ new line"
    },
    "post": {
      "anonAuthor": "Anonymous member",
      "reply": "Reply",
      "save": "Save",
      "replies": "{n} replies",
      "openThread": "Open thread",
      "replyPlaceholder": "Write a kind reply…"
    },
    "empathy": {
      "felt": "Felt this",
      "holding": "Holding space",
      "candle": "Lighting a candle",
      "glad": "So glad for you",
      "applause": "Quiet applause"
    },
    "members": {
      "title": "Members",
      "search": "Find a member…",
      "moderators": "Moderators",
      "onlineGroup": "Online — {n}",
      "idleGroup": "Idle — {n}",
      "offlineGroup": "Offline — {n}",
      "you": "(you)",
      "mod": "Mod"
    },
    "about": {
      "title": "About this circle",
      "readCharter": "Read the charter"
    }
  }
}
```

Mirror to `am.json`.

---

## Step 13 — Safety + moderation hooks

- Every post and reply must have a "Report" item in its `<MoreHorizontal />` menu. Reporting opens a small dialog with reason categories (Crisis / Harassment / Off-topic / Spam / Other) and a free-text note. POST to `/api/groups/{id}/reports`.
- If a post is auto-flagged by the server for crisis keywords, render a soft sage banner at the top of that post: "MindEase noticed this might be heavy. Crisis resources are one tap away." with a button that opens the global `<CrisisBanner />`. Do NOT block the post.
- Mods can pin, lock-replies, or remove any post. Mod actions show a small mono caps "— {action} by {mod} · {time}" note in place of removed content (Reddit-style transparency).
- Anonymous posts can still be removed by mods; the original author gets a notification.

---

## Step 14 — Mobile (below 1024px)

- Left rail → bottom-tab section in a `<Sheet>` from the hamburger
- Right rail → "Members" button in `RoomHeader` opens a `<Sheet>` from the right
- Tabs row: horizontally scrolls if needed
- Composer: sticks to bottom (above mobile keyboard). Tag pills wrap below the title.
- Empathy reactions: limit visible count to 3, "+ {n}" pill for the rest

---

## Step 15 — Verification checklist

- [ ] `/groups/{slug}/?room=daily-check-in` renders feed for that room
- [ ] Switching rooms updates the URL and the feed
- [ ] Active room highlights correctly in left rail
- [ ] Unread rooms show 2px sage left indicator
- [ ] Empathy reactions toggle optimistically and update counts in real time
- [ ] Anonymous post author renders as dashed `?` avatar + "Anonymous member" name
- [ ] CW pill appears in clay tone for tagged posts
- [ ] Daily prompt card appears in `#daily-check-in` only, hides after the user answers
- [ ] Replies preview shows up to 3 stacked avatars + latest excerpt + "Open thread" link
- [ ] Inline thread renders all replies with avatar + name + time + clay heart count
- [ ] Composer auto-grows, supports ⌘⏎, anonymous toggle persists in form state until submit
- [ ] Members rail groups Moderators / Online / Idle / Offline with correct counts
- [ ] Idle dot honey-tinted, offline dot foreground-tinted
- [ ] Current user row highlighted with sage tint and "(you)" suffix
- [ ] Pinned banner appears with honey accent + mod attribution
- [ ] Report flow opens a dialog and POSTs to `/api/groups/{id}/reports`
- [ ] Mod-pinned, mod-removed states render correctly
- [ ] No console errors, no hydration warnings
- [ ] Light + dark themes both work
- [ ] Mobile: rails collapse into sheets, composer remains usable above keyboard

---

## Out of scope

- Voice rooms / live audio (Discord parallel)
- DMs UI within group rail (link to existing 1-on-1 chat is fine)
- Reactions on individual replies (only top-level posts get reaction pills for v1; replies get the clay heart only)
- Reaction emoji picker beyond the 5 default empathy ones
- Cross-posting flow (the "(cross-post)" tag in the mockup is display-only for v1)

If anything in the mockup is ambiguous — empathy taxonomy wording, mod-action audit format, anonymity guarantees — **stop and ask**. The trust model is the most sensitive part of this surface.
