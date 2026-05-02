# MindEase — Design Handoff

A complete redesign of the MindEase mental-health companion app: Landing, Auth (Login + Register), Dashboard, Chat, Mood Tracking, and Global Navigation.

---

## About these files

The files in `mockups/` are **design references created in HTML** — high-fidelity prototypes showing intended look, layout, copy, and interactions. They are **not production code to copy**. Your job (Claude Code) is to **recreate these designs inside the existing `frontend/` Next.js codebase**, using its established conventions: shadcn/ui (new-york style), Radix primitives, Tailwind v3 with CSS variables, lucide-react icons, next-intl for i18n, next-themes for dark mode, and recharts for charts.

The mockups use vanilla HTML/CSS + a tiny React/Babel wrapper for the Tweaks panel — ignore the Tweaks panel during port; it's a design-exploration tool, not part of the product.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, copy, and interactions are intentional. Match them pixel-for-pixel where reasonable, but defer to the existing codebase's component primitives (e.g. shadcn `<Button>`, `<Card>`, `<Dialog>`) rather than re-implementing chrome from scratch. Use the design tokens in `DESIGN_TOKENS.md` as the source of truth.

## Stack (already in `frontend/`)

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind v3 + CSS variables (`globals.css`) + `tw-animate-css`
- **Component lib:** shadcn/ui (`new-york` style, slate base) — already installed in `src/components/ui/`
- **Primitives:** Radix UI (dialog, dropdown, scroll-area, tabs, toast, tooltip, etc.)
- **Icons:** `lucide-react`
- **Charts:** `recharts`
- **i18n:** `next-intl` (en + am Amharic locales already wired)
- **Theming:** `next-themes` (light/dark already wired)
- **Auth:** `@react-oauth/google`

## Important — palette change

The existing `frontend/src/app/globals.css` uses a **teal-based palette** (`--primary: hsl(193 39% 49%)`). The new mockups use a **sage-green / warm-clay palette** that better matches the calmer, more editorial mental-health aesthetic the redesign aims for.

**You MUST update `globals.css` to the new palette** before porting components. See `DESIGN_TOKENS.md` → "Color tokens" for the full replacement. All component code can stay theme-agnostic (referencing `--primary`, `--accent`, etc.) so swapping the variables propagates throughout.

---

## Bundle contents

```
design_handoff_mindease/
├── README.md              ← this file (start here)
├── DESIGN_TOKENS.md       ← exact colors, type, spacing, radii to apply
├── FILE_MAP.md            ← mockup → existing-route/component mapping
└── mockups/
    ├── Landing.html       ← / (public)
    ├── Auth.html          ← /(auth)/login + /(auth)/register (split-screen)
    ├── Dashboard.html     ← /(main)/dashboard
    ├── Chat.html          ← /(main)/chat + /(main)/chat/[conversationId]
    ├── MoodTracking.html  ← /(main)/mood
    ├── GlobalNav.html     ← top-nav system + mobile sheet (TopNav, MobileNav)
    └── tweaks-panel.jsx   ← ignore (design-time only)
```

---

## How to use this bundle (suggested order)

1. **Read `DESIGN_TOKENS.md`** and update `frontend/src/app/globals.css` color variables. Add the serif font import (Fraunces alternative — see token doc) and any new utility animations.
2. **Read `FILE_MAP.md`** to see which mockup maps to which existing file. Most existing components are stubs/v1; expect to rewrite their internals while keeping the file paths and exports intact.
3. **Open each mockup HTML in a browser** to study the layout and interactions live (they're standalone — just double-click). Several have a **Tweaks** button — click it to see the variation space; the *default* state is the spec.
4. **Port screen-by-screen in this order** (lowest dependency → highest):
   1. Tokens + globals.css
   2. `GlobalNav.html` → `TopNav.tsx` + `MobileNav.tsx` + `Logo.tsx`
   3. `Landing.html` → `app/page.tsx`
   4. `Auth.html` → `(auth)/login/page.tsx` + `(auth)/register/page.tsx` + shared `(auth)/layout.tsx`
   5. `Dashboard.html` → `(main)/dashboard/page.tsx`
   6. `MoodTracking.html` → `(main)/mood/page.tsx` + the `components/mood/*` widgets
   7. `Chat.html` → `(main)/chat/*` + `components/chat/*`

---

## Per-screen specs

### 1. Landing (`mockups/Landing.html`)

**Route:** `app/page.tsx` (already exists — currently a redirect/placeholder; replace with marketing landing).

**Purpose:** Public marketing page that explains MindEase, builds trust (privacy, evidence-based), and converts visitors to sign-up.

**Layout (top → bottom):**
1. **Top bar (sticky):** Logo + nav links (How it works, Privacy, Resources) + lang switcher + "Sign in" + primary CTA "Get started — free"
2. **Hero:** Editorial split — left column has eyebrow tag, oversized serif headline ("A quieter place to *think* it through."), 2-line lede, dual CTAs (primary "Start your first session" + ghost "How it works"), trust row (encrypted, evidence-based, no judgment). Right column has a chat-preview card showing a sample exchange + mood pill.
3. **"How it works" — 3 steps:** Numbered cards (Reflect → Track → Practice) with one-line descriptions.
4. **Feature grid (2×2 or 4-up):** Conversations, Mood tracking, Resources, Crisis support — each a simple card with icon, title, 1-sentence body.
5. **Testimonial / quote block:** Single oversized pull-quote on a sage-tinted band, attributed to an anonymized first-name + context ("— Maya, 28, NYC"). Note: use only fictional/illustrative quotes unless real testimonials are provided.
6. **Privacy / safety stripe:** 3-column reassurance — "End-to-end encrypted", "Your data, your rules", "Crisis resources always one tap away."
7. **Final CTA band:** Centered, generous whitespace, single primary button + small disclaimer ("MindEase is not a replacement for professional care. If you're in crisis, call/text 988.").
8. **Footer:** Logo, link columns (Product / Company / Legal / Support), language + theme toggle, copyright.

**Typography:**
- Headline: serif display, ~64–80px, weight 400, italic accent on key word
- Body: Inter (existing `--font-inter`), 16–18px

**Notable interactions:**
- Sticky top bar gets a subtle shadow + bg blur once scrolled > 8px
- Hero CTAs have a soft hover state (slight bg-darken + 1px y-translate)
- Feature cards have a hover state (border tints to primary, shadow lifts)
- Crisis disclaimer link in footer goes to a tooltip/popover with hotline numbers (988 in US, locale-aware via next-intl)

---

### 2. Auth (`mockups/Auth.html`)

**Routes:**
- `app/(auth)/login/page.tsx` — already exists, replace
- `app/(auth)/register/page.tsx` — already exists, replace
- `app/(auth)/layout.tsx` — provides the split-screen shell

**Form components:**
- `components/auth/LoginForm.tsx` — replace
- `components/auth/RegisterForm.tsx` — replace

**Layout:** Split-screen (50/50 on desktop, stacked on mobile).

- **Left panel (brand):** Default style is **photo background** with dark gradient overlay. Brand mark "MindEase" anchored top-left, big serif headline + 1-line sub-copy + "Brand · Calm by design" anchored bottom-left. On Login: the headline is "Welcome back to your quiet space." On Register: "Start with a single conversation."
- **Right panel (form):** White (or `--card`) background. Padded header with eyebrow + title + 1-line subtitle. Form fields stacked, generous vertical rhythm. "Or continue with" divider. Google sign-in button (use existing `GoogleSignInButton.tsx`). Footer link to switch login ↔ register, plus tiny legal copy on register ("By creating an account you agree to…" with linked Terms + Privacy).

**Login form fields:** Email, Password (+ "Forgot password?" link), Remember me checkbox, Submit button "Sign in".

**Register form fields:** Full name, Email, Password (with strength meter — 4 segments, sage→amber→clay), Confirm password (with live match check), Submit button "Create account".

**Validation:**
- Use `react-hook-form` + `zod` (NOT currently in `package.json` — install both).
- Email: standard email regex
- Password (register): min 8 chars, must contain at least one letter and one number; strength meter levels: weak / okay / good / strong
- Confirm password must match (live-validated, shake animation on mismatch — already have `slide-down`/`fade-in` keyframes; add a tasteful shake)

**State:** loading state on submit (button shows spinner + "Signing in…" / "Creating account…"), error state (inline field error in destructive color, shadow-tinted with a tiny icon).

**Brand-panel variants** (optional Tweaks — implement only the photo default initially): Dark solid, Sage tint, Photo. Photo is the ship default.

---

### 3. Dashboard (`mockups/Dashboard.html`)

**Route:** `app/(main)/dashboard/page.tsx` (already exists, replace).

**Purpose:** The user's home — emotionally warm greeting + at-a-glance status + clear CTAs into the day's practice.

**Layout (a 12-col grid):**
1. **Hero greeting (full-width):** Time-aware greeting ("Good evening, Maya"), one-line context line ("It's been 3 days since you last checked in — no pressure."), and a primary "Start a session" CTA + ghost "Quick mood check-in" CTA.
2. **Stat cards row (3-up):** Streak (current streak in days, sub-label "Longest: 14"), Average mood (last 7 days, with up/down delta), Sessions this week (number + sparkline using recharts).
3. **Mood widget (left, 8-col):** A simplified weekly mood row — 7 day-pills with mood-color fills (use `DashboardMoodWidget.tsx` — needs a redesign). Tapping a pill opens the mood check-in dialog.
4. **Right-rail (4-col):** "Today's reflection" — a single soft prompt card with a one-line question and "Reflect →" button. Below: "Suggested resource" — a compact card with an article excerpt.
5. **Recent conversations (full-width):** 3 most-recent conversation cards (title + preview + relative time + mood tag), with "View all →" linking to `/chat`.
6. **Footer band:** "Your data is yours" reassurance + tiny "Need help now? Crisis resources" link.

**Interactions:**
- All cards have a soft hover lift (`shadow` deepens, border tints `--primary/30`).
- Mood pills animate the fill on hover (subtle scale + color saturation up).
- Stat-card sparklines are recharts `<LineChart>` with `--primary` stroke, no axes, generous padding.
- Pull data via existing `useMoodData.ts` and `useConversations.ts` hooks; loading state = skeletons (use shadcn `<Skeleton>`).

---

### 4. Chat (`mockups/Chat.html`)

**Routes:**
- `app/(main)/chat/page.tsx` — already exists (chat list / new-chat landing)
- `app/(main)/chat/[conversationId]/page.tsx` — already exists (a conversation)
- `app/(main)/chat/layout.tsx` — provides the chat-specific shell **with the conversation sidebar** (this is the only place a sidebar appears)

**Components:**
- `components/chat/ChatSidebar.tsx` — replace; this is the conversation-history rail
- `components/chat/ConversationList.tsx` + `ConversationItem.tsx` — replace
- `components/chat/ChatContainer.tsx` — replace (main column orchestrator)
- `components/chat/MessageList.tsx` + `MessageBubble.tsx` + `StreamingMessage.tsx` + `TypingIndicator.tsx` — replace
- `components/chat/ChatInput.tsx` — replace
- `components/chat/StarterPrompts.tsx` — replace
- `components/chat/CrisisBanner.tsx` — replace (matches new palette)

**Layout (3 zones, only on `/chat` routes):**
1. **Global TopNav** (always present, see GlobalNav spec)
2. **Left sidebar** (~280px, collapsible — store collapsed state in localStorage):
   - "New conversation" button (full-width primary)
   - Search input
   - Grouped conversation list: **Today**, **Yesterday**, **This week**, **Earlier** — each item shows title (auto-derived from first message) + 1-line preview + relative time + a tiny mood-tag dot
   - Footer: tiny "🔒 End-to-end encrypted" line + collapse handle
3. **Main column:**
   - **Empty state** (when no conversation selected): centered serif headline ("What would you like to think through today?"), 4 starter-prompt chips (e.g. "Untangle a worry", "Reflect on my day", "Practice a hard conversation", "Just sit with me"), composer at bottom
   - **Conversation state:** Disclaimer banner at top (use existing `DisclaimerBanner.tsx`, restyled), message list (user msgs right-aligned with `--primary`-tinted bubble, assistant msgs left-aligned with `--muted` bg + slight serif accent for tone), streaming message with blinking cursor (already have `animate-blink-cursor`), typing indicator (3 bouncing dots — already have `animate-bounce-dot`), composer at bottom
   - **Composer:** Multiline `<Textarea>` (auto-grow up to 6 lines), send button (icon-only when empty input, full button when filled), char counter on the right (subtle, only when > 80% of limit), keyboard hint ("Enter to send · Shift+Enter for new line")
   - **Crisis detection:** if user message contains crisis keywords (handled server-side; surface `CrisisBanner` from existing component) — banner slides down above the message list with the 988 link + "I'm safe, dismiss" action

**Interactions:**
- Sidebar conversation items: hover bg + active state (left 2px primary border + bg `--accent/20`)
- Sending a message: optimistic append + streaming-message component listens to `useWebSocket` (already exists in `hooks/useWebSocket.ts`)
- Message bubbles fade-in (use existing `animate-fade-in`)
- Mobile: sidebar becomes a `<Sheet>` (shadcn) opened via the hamburger in TopNav

---

### 5. Mood Tracking (`mockups/MoodTracking.html`)

**Route:** `app/(main)/mood/page.tsx` (already exists, replace).

**Components to redesign:**
- `MoodCheckIn.tsx` — the input modal/drawer
- `MoodLineChart.tsx` — replace with recharts impl matching new tokens
- `MoodCalendarHeatmap.tsx` — calendar grid, mood-color fills
- `MoodDistribution.tsx` — donut or horizontal-bar chart of mood frequencies
- `MoodStatsCards.tsx` — three stat cards (current streak, longest streak, avg mood)
- `BadgeCollection.tsx` + `BadgeCelebration.tsx` — gentle achievement system

**Layout:**
1. **Page header:** Title "Mood" (serif), subtitle "How you've been feeling.", primary action "Log today's mood"
2. **Stats row (3-up):** MoodStatsCards (current streak / longest streak / 30-day avg mood with arrow indicator)
3. **Tabbed view** (use shadcn `<Tabs>`): **Trends** (line chart) | **Calendar** (heatmap) | **Distribution** (donut) | **Badges**
4. **Trends tab:** recharts `<LineChart>` showing 30 days of mood scores (1–5 scale), Y-axis labeled with mood emoji/labels, X-axis dates, tooltip on hover with the day's note
5. **Calendar tab:** Month grid; each cell colored by that day's mood (no entry = subtle dashed outline). Click a cell to see/edit that day's entry.
6. **Distribution tab:** Donut chart of mood frequencies over selected range, with legend on right
7. **Badges tab:** Grid of badge cards (locked = greyscale + lock icon, unlocked = full color); celebration animation (use `BadgeCelebration.tsx` — confetti is too loud for this brand, prefer a soft scale+glow)

**Mood scale (5 levels):** Awful, Low, Okay, Good, Great. Map to colors `--mood-1` through `--mood-5` (defined in `DESIGN_TOKENS.md`).

**MoodCheckIn modal:** Use shadcn `<Dialog>`. Slider or 5-button row for mood selection, optional 1-line note ("What's on your mind?"), submit. Saves via `useMoodData.ts`.

---

### 6. Global Nav (`mockups/GlobalNav.html`)

**Components:**
- `components/layout/TopNav.tsx` — the global top bar (replace)
- `components/layout/MobileNav.tsx` — the mobile hamburger sheet (replace)
- `components/layout/Header.tsx` — may be redundant; consolidate with TopNav
- `components/layout/Sidebar.tsx` + `SidebarContent.tsx` — **only used inside `(main)/chat/layout.tsx`** for conversation history; do NOT use as global nav
- `components/shared/Logo.tsx` — text wordmark "MindEase" in serif + small leaf/wave glyph

**Top nav structure (desktop):**
- Left: Logo
- Center: Nav items — Dashboard, Chat, Mood, Resources (use `Link` from `next/link`, active state: bottom 2px primary border + foreground color)
- Right: LanguageSwitcher (existing) → ThemeToggle (existing) → User avatar dropdown (shadcn `<DropdownMenu>` — Profile / Settings / Sign out)

**Mobile (< 768px):**
- Logo left, hamburger right (no center nav)
- Hamburger opens shadcn `<Sheet>` from the right with: nav items (Dashboard / Chat / Mood / Resources / Profile / Settings) + footer with user info + Sign out

**Notable detail — sidebar appears ONLY on `/chat`:** The previous design had a global sidebar; the new design uses **top nav globally** and adds the conversation sidebar **only on `/chat`** routes (placed inside `app/(main)/chat/layout.tsx`).

---

## Interactions & motion (global)

- **Easings:** Use Tailwind defaults (`ease-out` / `ease-in-out`) and these keyframes from `globals.css`: `animate-slide-down`, `animate-fade-in`, `animate-slide-in-right`, `animate-blink-cursor`, `animate-bounce-dot`. Add a soft `animate-shake` for form errors (translate ±4px over 300ms, 3 cycles).
- **Durations:** 200ms for hover/click, 250–300ms for component mount/dismount, 600ms for celebrations.
- **Reduced motion:** Existing `prefers-reduced-motion: no-preference` guard in `globals.css` already covers this — keep new animations behind the same guard.

## State management

- **Conversations:** existing `ConversationsContext.tsx` + `useConversations.ts` hook
- **Mood data:** existing `useMoodData.ts` hook
- **Auth:** existing `useAuth.ts` hook + `GoogleAuthProvider.tsx`
- **WebSocket / streaming:** existing `useWebSocket.ts` + `lib/websocket.ts`
- **Toasts:** existing `use-toast.ts` + shadcn `<Toaster />`

Do not introduce a new state library (Zustand/Redux/etc.) — extend the existing context + hooks.

## Copy & voice

The redesign uses a deliberately **calm, plain, slightly literary voice**. Avoid:
- Therapy jargon ("CBT", "modality", "intervention")
- Overly chirpy/emoji-heavy copy ("Let's gooo! 🎉")
- Tech-bro phrasing ("AI-powered", "leverage", "unlock")

Prefer short sentences, lowercase emphasis sparingly, and serif italic for the one emotional word per heading (e.g. "A quieter place to *think* it through.").

All user-facing strings must go through **next-intl** — keys live in `src/messages/en.json` and `src/messages/am.json`. When porting, add new keys following the existing nesting (e.g. `landing.hero.headline`).

## i18n notes

- `am` (Amharic) is already wired via `next-intl` and uses `Noto Sans Ethiopic` (already imported in `globals.css`).
- The serif display font (Fraunces — see DESIGN_TOKENS) only applies to Latin script. For Amharic, fall back to `Noto Sans Ethiopic` for headings as well — set this via the existing `html[data-locale="am"]` selector in `globals.css`.

## Accessibility

- All interactive elements must be keyboard-navigable; current Radix/shadcn primitives handle this. Don't strip focus rings — `*:focus-visible` is set in `globals.css`.
- Color contrast: every token pair in `DESIGN_TOKENS.md` is AA-compliant for body text. Verify when extending.
- Mood colors should never be the *only* signal — always pair with a label/emoji.
- Crisis content (banner, footer) must be reachable in ≤ 2 tabs from any screen.

## Out of scope for this handoff

- Backend / API contracts (no changes — keep existing `lib/api.ts`)
- WebSocket protocol (no changes — keep existing `lib/websocket.ts`)
- Auth provider config (Google OAuth setup, env vars)
- The `tweaks-panel.jsx` file — design-time only, don't port

## Quick start prompt for Claude Code

> Read `design_handoff_mindease/README.md`, `DESIGN_TOKENS.md`, and `FILE_MAP.md`. Then update `frontend/src/app/globals.css` with the new color tokens. Once that's verified visually (run `npm run dev`), port screens in this order: GlobalNav → Landing → Auth → Dashboard → Mood → Chat. For each screen, open the corresponding HTML mockup in a browser to study the *default* (Tweaks-off) state — that's the spec. Use the existing shadcn primitives in `components/ui/`, the existing hooks in `hooks/`, and lucide-react icons. Match copy verbatim from the mockups.
