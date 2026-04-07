You are working on Chance, a social party app. Apply the following UX style guide to all UI work in this session.

---

# Chance — UX Style Guide · Neon Speakeasy · Art Deco

## The Feeling

A bar with no sign outside. Inside: dark, warm, a little electric. The drinks are strong, the cards are sharper. Nothing is loud — everything has _presence_. Chance should feel like it belongs on a felt table at 11pm. Not a casino — too gaudy. Not a dive — too rough. This is a shared experience: one phone, passed around a table. Every design decision should make that handoff feel natural.

---

## Color

| Role | Name | Hex | Token |
|------|------|-----|-------|
| Background | Deep navy-charcoal | `#0E0F1A` | `--color-bg` |
| Surface (cards, modals) | Lifted dark | `#161824` | `--color-surface` |
| Surface elevated | Subtle step up | `#1E2133` | `--color-surface-elevated` |
| Border / divider | Dim gold | `#3A3220` | `--color-border` |
| Primary accent | Electric violet | `#8B7FE8` | `--color-accent-primary` |
| Secondary accent | Warm amber | `#D4A847` | `--color-accent-amber` |
| Flash accent | Speakeasy green | `#4ECBA0` | `--color-accent-green` |
| Text primary | Warm off-white | `#F0EDE4` | `--color-text-primary` |
| Text secondary | Muted warm gray | `#8A8578` | `--color-text-secondary` |
| Danger / flag | Deep crimson | `#C0392B` | `--color-danger` |
| Success / resolved | Faded teal | `#2E8B74` | `--color-success` |

**Rules:**
- There is no light mode. Backgrounds are always dark.
- One accent per surface — they never compete.
- Amber: warmth and reward (upvotes, resolved cards, host actions).
- Violet: primary actions, navigation, interactive focus states.
- Green: live draw moments only — it flashes on tap, then settles. Never decorative.
- Gold borders and dividers give the art deco geometry without gilding everything.
- Never place gray text on accent-colored surfaces.

---

## Typography

Two typefaces only.

**Display — _Cormorant Garamond_ (Bold / SemiBold)**
Geometric serif. Used for: card titles, screen headings, the app name. Letter-spacing: `-0.02em`.

**UI — _DM Sans_ (Regular / Medium)**
Clean sans-serif. Used for: body copy, labels, form fields, metadata, any text that isn't a heading or card title.

| Token | Size | Face | Weight | Use |
|-------|------|------|--------|-----|
| `--text-display` | 32px | Cormorant Garamond | 700 | App name, major screen headings |
| `--text-heading` | 22px | Cormorant Garamond | 600 | Card titles, modal headings |
| `--text-subheading` | 16px | DM Sans | 500 | Section labels, player names |
| `--text-body` | 15px | DM Sans | 400 | Body copy, card descriptions |
| `--text-caption` | 12px | DM Sans | 400 | Timestamps, metadata |
| `--text-label` | 11px | DM Sans | 500 | Badges, status pills — all caps, `0.15em` tracking |

**Rules:**
- Display face: headings, card titles, session names only — never body copy.
- All-caps with `0.15em` tracking: labels, badges, section markers only. Never headings.
- No font sizes below 11px.
- Line height: `1.5` for body text, `1.2` for display and headings.

---

## Cards

Cards are the heart of the app.

**Anatomy:**
- Aspect ratio: `3:4`
- Dark surface (`--color-surface`) with a 1px gold border (`--color-border`)
- Art deco chamfered or stepped corners — not simple rounded rects
- Card image fills the top half with a gentle vignette bleeding into the body
- Title in display face (`--text-heading`), warm off-white
- Description in UI face (`--text-body`), secondary text color

**States:**
- **Face-down:** solid dark surface, gold border, app logo centered
- **Private (just drawn):** full content visible to active player; subtle violet glow on border
- **Revealed:** content fully visible; glow settles
- **Hidden (pre-reveal for others):** description area shows fine geometric hatching; title visible
- **History (past draws):** slightly smaller, stacked; each prior card drops 8% opacity; at most 3 visible before collapsing
- **Resolved:** amber tint overlay at 20% opacity; `RESOLVED` badge (all caps, `--color-accent-amber`, `--text-label`) in upper corner

**Reveal animation:** slides up `24px`, rotates `2deg → 0deg`. Duration: `380ms`, `cubic-bezier(0.4, 0, 0.2, 1)`. No bounce.

---

## Motion

Deliberate. Nothing bounces. Nothing spins for fun.

| Element | Behavior | Duration |
|---------|----------|----------|
| Card deal | Slides up `24px` + rotates `2deg → 0deg`, sharp deceleration | `380ms` |
| Card flip (reveal) | Front face fades in over a subtle Y-axis rotation | `300ms` |
| Modal open | Fades in + translates up `16px` | `240ms` |
| Modal close | Fades out + translates down `8px` | `160ms` |
| Toast | Slides in from top, pauses `2.5s`, fades out | `200ms` in / `160ms` out |
| Player switcher | Crossfade between active player name and pill highlight | `180ms` |
| Draw button tap | Single pulse of `--color-accent-green` on border, then settles | `220ms` |
| Screen transition | Slide left (forward) / slide right (back), `12px` travel + fade | `260ms` |

**Rules:**
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions.
- No looping animations except the Draw button idle: very slow violet border pulse (`4s` loop, 10% opacity swing).
- Only animate `transform` and `opacity`. Never animate `height`, `width`, `padding`, or `margin`.
- `prefers-reduced-motion`: all animations collapse to simple `opacity` fades at `150ms`.

---

## Iconography

Thin-stroke icons only (`1.5px` stroke weight). No filled icons except active/selected states.

Art deco motifs (sparingly, never as functional icons):
- `◆` Diamond separators between metadata items
- `«»` Chevron pairs instead of single arrows for navigation
- A stylized **C** or card-suit mark as the app logo

Functional icons: clean and geometric, `20px` with `4px` optical padding from adjacent text.

---

## Layout & Spacing

Spacing scale (4px base): `4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64px`. No off-scale values.

- CSS spacing tokens: `--space-1` (4px) through `--space-16` (64px)
- Minimum internal padding on cards and modals: `20px`
- Section dividers: 1px gold line (`--color-border`) or geometric ornament
- Bottom-anchored primary actions: full-width or near-full-width, `16px` from safe area bottom
- Minimum touch target: `44×44px` on all interactive elements
- Safe area insets respected on all screens

---

## Player Switcher

- Fixed to the top of the Game and Card screens
- All players displayed as a horizontal strip of compact name pills
- Active player pill: `--color-accent-primary` background, `--color-text-primary` label, slightly taller
- Inactive players: `--color-surface-elevated` pill, `--color-text-secondary` label
- Tapping switches active player (`180ms` crossfade)
- Draw button only enabled for the currently active player

---

## The Draw Button

- Large, nearly full-width, bottom-anchored. Height: `56px`
- Dark surface (`--color-surface`) with `1.5px` `--color-accent-primary` border
- **Idle:** violet border with slow barely-there breathing glow. Label: **DRAW**
- **On tap:** border flashes `--color-accent-green` for `220ms`, then returns to violet
- **Loading:** border pulses violet at `1s` interval (background sync, not a blocker)
- **Disabled:** border dims to `--color-border`, label shifts to `--color-text-secondary`
- Label: **DRAW** — all caps, `0.15em` tracking, display face

---

## States & Feedback

**Loading:** Skeleton screens in the exact shape of incoming content. Color: `--color-surface-elevated` with slow shimmer sweep (`1.5s` loop). No spinners.

**Empty states:** Name the state ("No cards drawn yet."). Include a quiet prompt. Use the app logo mark as a dim decorative anchor (`--color-border` fill).

**Error states:** Inline, not modal. Copy is dry: **"That didn't work."** + text-link retry: **"Try again."** Connection loss: `NetworkStatusBanner` — slim amber bar at top, not alarming.

**Success:** Most successes are silent — the UI just reflects the new state. Exceptions: card submission confirmed, card transfer accepted → brief toast. Toasts: dark surface, thin amber border, icon + one line.

---

## Voice & Copy

Short. Confident. Slightly knowing.

| Say this | Not this |
|----------|----------|
| **Draw** | "Draw a card" |
| **End game** | "End game session" |
| **Your turn** | "It is currently your turn to draw" |
| **Resolved** | "This card has been marked as resolved" |
| **Something changed** | "Session filter settings have been updated" |
| **That didn't work.** | "An error occurred. Please try again later." |
| **Waiting for {Name}** | "It is {Name}'s turn to draw a card" |
| **{Name} passed the card** | "A card transfer has been initiated by {Name}" |

Periods on complete sentences, not on labels. The app doesn't over-explain — trust the player.
