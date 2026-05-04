# File Map — Mockup → Existing Codebase

This maps each design mockup to the existing files in `frontend/`. **Most existing files are stubs or v1 implementations** — expect to rewrite their contents while keeping their paths and exported names intact (so imports elsewhere don't break).

Legend:
- ✏️ **Replace internals** — keep file path + exports, rewrite body
- ➕ **Create new file** — doesn't exist yet
- 🔧 **Modify** — surgical edit
- 🗑️ **Likely deletable** — appears redundant after redesign

---

## Mockup: `Landing.html`

| Section | Existing file | Action |
|---|---|---|
| Whole page | `src/app/page.tsx` | ✏️ Replace — currently a redirect/placeholder |
| Top bar | `src/components/Navbar.tsx` (legacy) OR new `components/landing/LandingNav.tsx` | ➕ Create new — landing has its own nav, not the authenticated TopNav. Keep `Navbar.tsx` if used by privacy/terms pages, otherwise 🗑️ |
| Hero, How it works, Features, Testimonial, Privacy stripe, Final CTA, Footer | new `components/landing/*` | ➕ Create — `Hero.tsx`, `HowItWorks.tsx`, `FeatureGrid.tsx`, `TestimonialBand.tsx`, `PrivacyStripe.tsx`, `FinalCTA.tsx`, `LandingFooter.tsx` |

---

## Mockup: `Auth.html`

| Section | Existing file | Action |
|---|---|---|
| Split-screen layout shell | `src/app/(auth)/layout.tsx` | ✏️ Replace — render brand panel (left) + `{children}` (right) |
| Login page | `src/app/(auth)/login/page.tsx` | ✏️ Replace — render `<LoginForm />` inside right panel |
| Register page | `src/app/(auth)/register/page.tsx` | ✏️ Replace — render `<RegisterForm />` inside right panel |
| Login form | `src/components/auth/LoginForm.tsx` | ✏️ Replace — react-hook-form + zod |
| Register form | `src/components/auth/RegisterForm.tsx` | ✏️ Replace — RHF + zod, password strength meter, confirm match |
| Brand panel | new `components/auth/BrandPanel.tsx` | ➕ Create — accepts `headline` + `subcopy` props, renders photo bg + dark gradient + brand mark |
| Google sign-in | `src/components/GoogleSignInButton.tsx` | 🔧 Modify — restyle to match new tokens (sage border on hover, parchment bg) |
| Google provider | `src/components/GoogleAuthProvider.tsx` | (unchanged — wraps the app) |

**Install for forms:** `npm install react-hook-form zod @hookform/resolvers`

---

## Mockup: `Dashboard.html`

| Section | Existing file | Action |
|---|---|---|
| Page | `src/app/(main)/dashboard/page.tsx` | ✏️ Replace |
| Greeting hero | new `components/dashboard/GreetingHero.tsx` | ➕ Create |
| Stat cards row | new `components/dashboard/StatCards.tsx` | ➕ Create — uses recharts sparklines |
| Weekly mood widget | `src/components/mood/DashboardMoodWidget.tsx` | ✏️ Replace — 7 day-pills with mood color fills |
| Today's reflection card | new `components/dashboard/ReflectionCard.tsx` | ➕ Create |
| Suggested resource card | new `components/dashboard/ResourceCard.tsx` | ➕ Create |
| Recent conversations row | new `components/dashboard/RecentConversations.tsx` | ➕ Create — pulls from `useConversations()` |
| Footer band | new `components/dashboard/FooterBand.tsx` | ➕ Create |

---

## Mockup: `Chat.html`

| Section | Existing file | Action |
|---|---|---|
| Chat layout (with sidebar) | `src/app/(main)/chat/layout.tsx` | ✏️ Replace — wrap children with `<ChatSidebar />` + main column |
| Empty / new-chat state | `src/app/(main)/chat/page.tsx` | ✏️ Replace |
| Active conversation | `src/app/(main)/chat/[conversationId]/page.tsx` | ✏️ Replace |
| Sidebar | `src/components/chat/ChatSidebar.tsx` | ✏️ Replace |
| Conversation list | `src/components/chat/ConversationList.tsx` | ✏️ Replace — grouped by Today/Yesterday/This week/Earlier |
| Conversation item | `src/components/chat/ConversationItem.tsx` | ✏️ Replace — title + preview + relative time + mood dot |
| Chat container (orchestrator) | `src/components/chat/ChatContainer.tsx` | ✏️ Replace |
| Disclaimer banner (top of chat) | `src/components/layout/DisclaimerBanner.tsx` | 🔧 Modify — restyle to new tokens |
| Crisis banner | `src/components/chat/CrisisBanner.tsx` | ✏️ Replace |
| Message list | `src/components/chat/MessageList.tsx` | ✏️ Replace |
| Message bubble | `src/components/chat/MessageBubble.tsx` | ✏️ Replace |
| Streaming message | `src/components/chat/StreamingMessage.tsx` | ✏️ Replace |
| Typing indicator | `src/components/chat/TypingIndicator.tsx` | ✏️ Replace |
| Composer | `src/components/chat/ChatInput.tsx` | ✏️ Replace — auto-grow textarea + char counter + Enter/Shift+Enter |
| Starter prompts | `src/components/chat/StarterPrompts.tsx` | ✏️ Replace |
| Duplicate `CrisisBanner` at root | `src/components/CrisisBanner.tsx` | 🗑️ Likely deletable (the chat-folder one is canonical) |
| Duplicate `DisclaimerBanner` at root | `src/components/DisclaimerBanner.tsx` | 🗑️ Likely deletable |

---

## Mockup: `MoodTracking.html`

| Section | Existing file | Action |
|---|---|---|
| Page | `src/app/(main)/mood/page.tsx` | ✏️ Replace — use shadcn `<Tabs>` (Trends / Calendar / Distribution / Badges) |
| Stats cards | `src/components/mood/MoodStatsCards.tsx` | ✏️ Replace |
| Line chart | `src/components/mood/MoodLineChart.tsx` | ✏️ Replace — recharts, new color tokens |
| Calendar heatmap | `src/components/mood/MoodCalendarHeatmap.tsx` | ✏️ Replace |
| Distribution chart | `src/components/mood/MoodDistribution.tsx` | ✏️ Replace — donut |
| Mood check-in modal | `src/components/mood/MoodCheckIn.tsx` | ✏️ Replace — shadcn `<Dialog>`, 5-button row, optional 1-line note |
| Badge collection | `src/components/mood/BadgeCollection.tsx` | ✏️ Replace |
| Badge celebration | `src/components/mood/BadgeCelebration.tsx` | ✏️ Replace — soft scale+glow (no confetti) |

---

## Mockup: `GlobalNav.html`

| Section | Existing file | Action |
|---|---|---|
| App shell layout | `src/app/(main)/layout.tsx` | ✏️ Replace — wraps `(main)` routes with `<TopNav />` only (no global sidebar) |
| Top nav | `src/components/layout/TopNav.tsx` | ✏️ Replace |
| Mobile sheet nav | `src/components/layout/MobileNav.tsx` | ✏️ Replace |
| Header (legacy) | `src/components/layout/Header.tsx` | 🗑️ Likely deletable — folded into TopNav |
| Logo wordmark | `src/components/shared/Logo.tsx` | ✏️ Replace — serif "MindEase" + small leaf glyph |
| Theme toggle | `src/components/ThemeToggle.tsx` | (keep — already wired to next-themes) |
| Language switcher | `src/components/LanguageSwitcher.tsx` | (keep — already wired to next-intl) |
| User dropdown | new `components/layout/UserMenu.tsx` | ➕ Create — shadcn `<DropdownMenu>` (Profile / Settings / Sign out) |
| Conversation sidebar | `src/components/layout/Sidebar.tsx` + `SidebarContent.tsx` | 🔧 Modify — repurpose for chat-only (mounted by `(main)/chat/layout.tsx`), no longer a global nav |

---

## Likely deletable (after redesign)

- `src/components/Navbar.tsx` — replaced by landing-specific nav + authenticated `TopNav`
- `src/components/CrisisBanner.tsx` (root) — duplicate of `components/chat/CrisisBanner.tsx`
- `src/components/DisclaimerBanner.tsx` (root) — duplicate of `components/layout/DisclaimerBanner.tsx`
- `src/components/layout/Header.tsx` — folded into `TopNav`

Verify nothing imports them before deletion (`grep -r "from.*Navbar"` etc.). When in doubt, leave the file with a 1-line stub re-export.

---

## New utility helpers to add

- `src/lib/relative-time.ts` — used in conversation list and dashboard ("3 days ago", "yesterday", etc.). Don't add a date-fns dependency just for this; a 30-line helper is enough.
- `src/lib/group-conversations.ts` — given a flat conversation list, returns `{ today: [], yesterday: [], thisWeek: [], earlier: [] }`.
- `src/lib/mood.ts` — single source of truth for mood scale: `getMoodLabel(score)`, `getMoodColor(score)` (returns the `--mood-N` CSS var name), `getMoodEmoji(score)`.
