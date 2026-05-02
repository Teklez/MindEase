# Design Tokens — MindEase Redesign

Replace `frontend/src/app/globals.css` `:root` and `.dark` blocks with the values below. Keep the structural rules (`* { border-color }`, `*:focus-visible`, body, html, html[data-locale="am"]) — only the color/radius/font tokens change.

---

## Color tokens (replaces existing `--*` HSL block)

The redesign moves from teal to a **sage-green primary** with **warm clay accents** and **off-white parchment surfaces**. All values below are HSL (matching the existing convention) and AA-compliant for body text.

### Light theme (`:root`)

```css
:root {
  /* Surfaces */
  --background: hsl(40 25% 97%);          /* #FAF8F3 — warm off-white parchment */
  --foreground: hsl(160 20% 12%);         /* #19241F — deep ink, slight green undertone */
  --card: hsl(0 0% 100%);                 /* pure white card on parchment */
  --card-foreground: hsl(160 20% 12%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(160 20% 12%);

  /* Brand */
  --primary: hsl(150 18% 38%);            /* #4F6A5A — sage green */
  --primary-foreground: hsl(40 25% 97%);
  --secondary: hsl(40 20% 92%);           /* #EDE8DD — warm sand */
  --secondary-foreground: hsl(160 20% 12%);
  --accent: hsl(20 38% 56%);              /* #C28968 — warm clay */
  --accent-foreground: hsl(40 25% 97%);

  /* Neutral utilities */
  --muted: hsl(40 18% 94%);               /* #F0EBE0 — paper tint */
  --muted-foreground: hsl(160 8% 38%);    /* #5A6360 — muted ink */
  --border: hsl(40 15% 87%);              /* #DCD7CB */
  --input: hsl(40 15% 87%);
  --ring: hsl(150 18% 38%);

  /* Semantic */
  --destructive: hsl(0 55% 46%);          /* #B6453B — restrained red */
  --destructive-foreground: hsl(40 25% 97%);
  --success: hsl(150 28% 38%);            /* #466F58 */
  --warning: hsl(30 50% 50%);             /* #BF8333 */

  /* Charts (recharts) */
  --chart-1: hsl(150 18% 38%);            /* sage primary */
  --chart-2: hsl(20 38% 56%);             /* clay accent */
  --chart-3: hsl(200 22% 48%);            /* dawn slate-blue */
  --chart-4: hsl(45 45% 55%);             /* honey */
  --chart-5: hsl(160 8% 38%);             /* muted ink */

  /* Radii */
  --radius: 0.875rem;                     /* 14px — slightly larger than current 12px */

  /* Mood scale (5 levels — awful → great) */
  --mood-1: hsl(355 35% 52%);             /* awful — muted rose */
  --mood-2: hsl(20 35% 55%);              /* low — clay */
  --mood-3: hsl(40 25% 60%);              /* okay — sand */
  --mood-4: hsl(150 22% 48%);             /* good — sage */
  --mood-5: hsl(170 30% 42%);             /* great — deep teal-sage */

  /* Sidebar (chat conversation rail) */
  --sidebar: hsl(40 22% 95%);
  --sidebar-foreground: hsl(160 20% 12%);
  --sidebar-primary: hsl(150 18% 38%);
  --sidebar-primary-foreground: hsl(40 25% 97%);
  --sidebar-accent: hsl(40 18% 90%);
  --sidebar-accent-foreground: hsl(160 20% 12%);
  --sidebar-border: hsl(40 15% 85%);
  --sidebar-ring: hsl(150 18% 38%);
}
```

### Dark theme (`.dark`)

```css
.dark {
  --background: hsl(160 14% 8%);          /* deep forest-ink */
  --foreground: hsl(40 18% 92%);
  --card: hsl(160 12% 11%);
  --card-foreground: hsl(40 18% 92%);
  --popover: hsl(160 12% 11%);
  --popover-foreground: hsl(40 18% 92%);

  --primary: hsl(150 24% 58%);            /* lifted sage for contrast */
  --primary-foreground: hsl(160 14% 8%);
  --secondary: hsl(160 10% 16%);
  --secondary-foreground: hsl(40 18% 92%);
  --accent: hsl(20 42% 64%);
  --accent-foreground: hsl(160 14% 8%);

  --muted: hsl(160 10% 14%);
  --muted-foreground: hsl(40 10% 64%);
  --border: hsl(160 10% 18%);
  --input: hsl(160 10% 18%);
  --ring: hsl(150 24% 58%);

  --destructive: hsl(0 55% 56%);
  --destructive-foreground: hsl(160 14% 8%);
  --success: hsl(150 30% 55%);
  --warning: hsl(30 55% 60%);

  --chart-1: hsl(150 24% 58%);
  --chart-2: hsl(20 42% 64%);
  --chart-3: hsl(200 28% 60%);
  --chart-4: hsl(45 50% 65%);
  --chart-5: hsl(40 10% 64%);

  --mood-1: hsl(355 40% 60%);
  --mood-2: hsl(20 40% 62%);
  --mood-3: hsl(40 30% 65%);
  --mood-4: hsl(150 28% 58%);
  --mood-5: hsl(170 32% 52%);

  --sidebar: hsl(160 12% 10%);
  --sidebar-foreground: hsl(40 18% 92%);
  --sidebar-primary: hsl(150 24% 58%);
  --sidebar-primary-foreground: hsl(160 14% 8%);
  --sidebar-accent: hsl(160 10% 16%);
  --sidebar-accent-foreground: hsl(40 18% 92%);
  --sidebar-border: hsl(160 10% 18%);
  --sidebar-ring: hsl(150 24% 58%);
}
```

---

## Typography

### Font families

Two families — Inter (body, already loaded) + a serif display.

**Add the serif display font** to `app/layout.tsx` using `next/font/google`:

```ts
import { Inter, Fraunces } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'opsz'],
  display: 'swap',
});

// in <html className={`${inter.variable} ${fraunces.variable}`}>
```

> **Note:** The system prompt for these mockups discourages overused fonts (Inter is already in the codebase — keep it for body, swap if a senior designer wants). For display, **Fraunces** (with optical-size + soft axis) gives the warm, slightly literary tone the mockups use. Acceptable alternatives: **Source Serif 4**, **Newsreader**. Avoid Playfair Display.

Then extend `tailwind.config.ts` `fontFamily`:

```ts
fontFamily: {
  sans: ["var(--font-inter)", "system-ui", "sans-serif"],
  serif: ["var(--font-fraunces)", "Georgia", "serif"],
},
```

### Type scale (used in mockups)

| Token         | Size      | Line-height | Weight | Use |
|---------------|-----------|-------------|--------|-----|
| Display XL    | 80–96px   | 1.02        | 400    | Hero headline (Landing) |
| Display L     | 56–72px   | 1.04        | 400    | Section heroes (Auth, Mood, Dashboard greeting) |
| Display M     | 40–48px   | 1.08        | 400    | Sub-heroes, modal titles |
| Heading 1     | 32px      | 1.15        | 500    | Page titles |
| Heading 2     | 24px      | 1.2         | 500    | Card group titles |
| Heading 3     | 18px      | 1.3         | 600    | Card titles, list-section labels |
| Body L        | 18px      | 1.55        | 400    | Lede, primary body |
| Body          | 16px      | 1.55        | 400    | Default body, form labels |
| Body S        | 14px      | 1.5         | 400    | Helper text, meta, sidebar items |
| Caption       | 12px      | 1.4         | 500    | Eyebrows, badges, timestamps |

Display sizes use **`font-serif`** (Fraunces). Everything else uses `font-sans` (Inter).

**Italic emphasis pattern:** In mockup headlines, exactly one word is italicized (e.g. *"A quieter place to **think** it through."*). Use `<em>` semantically. Set `font-style: italic` + slight `--font-fraunces` SOFT axis lift via `font-variation-settings: 'SOFT' 100;` for the calligraphic feel.

### Letter spacing

- Display sizes: `tracking-tight` (-0.02em)
- Caption / eyebrow: `tracking-wide` (0.05em) + uppercase

---

## Spacing scale

Tailwind defaults are fine. Mockups settle on these in particular:

- **Page horizontal padding:** `px-6` mobile / `px-8` tablet / `px-12` desktop / `px-16` 1280+
- **Section vertical rhythm:** `py-20` (mobile) → `py-32` (desktop) between major landing sections
- **Card interior padding:** `p-6` (compact) / `p-8` (default) / `p-10` (hero cards)
- **Card-to-card gap in grids:** `gap-6` (default) / `gap-8` (feature grids)
- **Form-field vertical gap:** `gap-5` between fields, `gap-2` between label+input
- **Hero → first section:** `pt-24 pb-32` on the hero section

---

## Border radius

- `--radius: 0.875rem` (14px) is the new default
- Tailwind tokens (already wired via the config):
  - `rounded-sm` → 10px
  - `rounded-md` → 12px
  - `rounded-lg` → 14px
  - Use `rounded-2xl` (16px) for cards, `rounded-xl` for inputs/buttons, `rounded-full` for pills/avatars

---

## Shadow scale

Add to `tailwind.config.ts`:

```ts
boxShadow: {
  'soft-sm': '0 1px 2px 0 hsl(160 20% 12% / 0.04)',
  'soft':    '0 4px 16px -4px hsl(160 20% 12% / 0.08)',
  'soft-md': '0 8px 24px -8px hsl(160 20% 12% / 0.12)',
  'soft-lg': '0 16px 40px -12px hsl(160 20% 12% / 0.16)',
}
```

Use `shadow-soft` for cards, `shadow-soft-md` on hover/active, `shadow-soft-lg` for modals/popovers.

---

## Animation tokens

The existing keyframes in `globals.css` (`slide-down`, `fade-in`, `slide-in-right`, `blink-cursor`, `bounce-dot`) are kept. **Add this one** for form-field error feedback:

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}
.animate-shake {
  animation: shake 0.32s ease-in-out;
}
```

Standard durations:
- Hover/state: 200ms
- Mount/dismount: 250–300ms
- Page transitions: 400ms
- Celebrations (badge unlock): 600ms

---

## Iconography

- **Library:** `lucide-react` (already installed)
- **Default size:** 20px (`w-5 h-5`) for inline UI; 16px in dense lists; 24px+ for feature highlights
- **Stroke width:** 1.75 (slightly thinner than default 2 — set globally via `<Icon strokeWidth={1.75} />` or wrap in a default-props helper)
- **Color:** `text-muted-foreground` by default, `text-primary` for active/selected states

Common mappings used in mockups:
- Chat: `MessageCircle`
- Dashboard: `LayoutDashboard` (or `Sparkles` for the warmer alt)
- Mood: `HeartPulse` (or `Smile`)
- Resources: `BookOpen`
- New conversation: `Plus`
- Search: `Search`
- Send: `ArrowUp` (in composer) or `Send`
- Settings: `Settings`
- Sign out: `LogOut`
- Crisis: `LifeBuoy`
- Encryption: `Lock` or `ShieldCheck`
- Theme toggle: `Sun` / `Moon`
- Language: `Languages`
