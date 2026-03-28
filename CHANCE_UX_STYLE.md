# Chance — UX Style Guide

### Neon Speakeasy · Art Deco · v0.1

---

## The Feeling

A bar with no sign outside. You know the right people, you know the code. Inside: dark, warm, a little electric. The drinks are strong, the cards are sharper. Nothing is loud — everything has _presence_.

Chance should feel like it belongs on a felt table at 11pm. Not a casino — too gaudy. Not a dive — too rough. Somewhere in between. The kind of place where the rules are understood but never posted.

This is a shared experience. One phone, passed around a table. Every design decision should make that handoff feel natural — the active player knows it's their moment, the others lean in.

---

## Color

A dark palette with surgical use of light. The background does the heavy lifting so the accents can whisper instead of shout.

| Role                    | Name               | Hex       | Token                      |
| ----------------------- | ------------------ | --------- | -------------------------- |
| Background              | Deep navy-charcoal | `#0E0F1A` | `--color-bg`               |
| Surface (cards, modals) | Lifted dark        | `#161824` | `--color-surface`          |
| Surface elevated        | Subtle step up     | `#1E2133` | `--color-surface-elevated` |
| Border / divider        | Dim gold           | `#3A3220` | `--color-border`           |
| Primary accent          | Electric violet    | `#8B7FE8` | `--color-accent-primary`   |
| Secondary accent        | Warm amber         | `#D4A847` | `--color-accent-amber`     |
| Flash accent            | Speakeasy green    | `#4ECBA0` | `--color-accent-green`     |
| Text primary            | Warm off-white     | `#F0EDE4` | `--color-text-primary`     |
| Text secondary          | Muted warm gray    | `#8A8578` | `--color-text-secondary`   |
| Danger / flag           | Deep crimson       | `#C0392B` | `--color-danger`           |
| Success / resolved      | Faded teal         | `#2E8B74` | `--color-success`          |

**Rules:**

- There is no light mode. Backgrounds are always dark.
- One accent per surface — they never compete.
- Amber: warmth and reward (upvotes, resolved cards, host actions).
- Violet: primary actions, navigation, interactive focus states.
- Green: live draw moments only — it flashes on tap, then settles. Never decorative.
- Gold borders and dividers give the art deco geometry without gilding everything.
- Never place gray text on accent-colored surfaces — tint toward the surface color instead.

---

## Typography

Two typefaces. No more.

**Display — _Cormorant Garamond_ (Bold / SemiBold)**
Geometric serif with strong vertical strokes and subtle ornamentation. Think Poirot's business card. Used for: card titles, screen headings, the app name. Letter-spacing: `-0.02em` — gives it the engraved, pressed-into-metal quality the aesthetic demands.

**UI — _DM Sans_ (Regular / Medium)**
Clean, slightly condensed sans-serif. Neutral but confident. Stands clear of the display face without competing. Used for: body copy, labels, form fields, metadata, and any text that isn't a heading or card title.

**Type Scale:**

| Token               | Size | Face               | Weight | Use                                                |
| ------------------- | ---- | ------------------ | ------ | -------------------------------------------------- |
| `--text-display`    | 32px | Cormorant Garamond | 700    | App name, major screen headings                    |
| `--text-heading`    | 22px | Cormorant Garamond | 600    | Card titles, modal headings                        |
| `--text-subheading` | 16px | DM Sans            | 500    | Section labels, player names                       |
| `--text-body`       | 15px | DM Sans            | 400    | Body copy, card descriptions                       |
| `--text-caption`    | 12px | DM Sans            | 400    | Timestamps, metadata                               |
| `--text-label`      | 11px | DM Sans            | 500    | Badges, status pills — all caps, `0.15em` tracking |

**Rules:**

- Display face: headings, card titles, session names only — never body copy.
- All-caps with `0.15em` tracking: labels, badges, and section markers only. Never headings.
- No font sizes below 11px.
- Line height: `1.5` for body text, `1.2` for display and headings.
- Use `clamp()` for fluid sizing on display and heading steps at larger viewports.

---

## Cards

Cards are the heart of the app. They deserve the most care.

**Anatomy:**

- Aspect ratio: `3:4` — tall enough to feel substantial, narrow enough to hold one-handed.
- Dark surface (`--color-surface`) with a 1px gold border (`--color-border`).
- Corner geometry: art deco chamfered or stepped corners — not simple rounded rects. The geometry is the detail.
- Card image fills the top half with a gentle vignette at the bottom edge, bleeding into the body.
- Title in the display face (`--text-heading`), warm off-white.
- Description in the UI face (`--text-body`), secondary text color.

**States:**

- **Face-down:** solid dark surface, gold border, the app logo mark centered — no content visible.
- **Private (just drawn):** full content visible to the active player. A subtle violet glow on the border signals it's live.
- **Revealed:** content fully visible. Glow settles. Other players see this state after `REVEAL_DELAY`.
- **Hidden (pre-reveal for others):** description area shows a fine geometric hatching pattern — clearly obscured, slightly tantalizing. Title is visible.
- **History (past draws):** slightly smaller, stacked. Each prior card drops 8% in opacity. At most 3 are visible before the stack collapses.
- **Resolved:** amber tint overlay at 20% opacity. A small `RESOLVED` badge (all caps, `--color-accent-amber`, `--text-label` scale) in the upper corner.

**Reveal animation:** the card slides up `24px` and rotates `2deg → 0deg`, like being dealt across a table. Duration: `380ms`, `cubic-bezier(0.4, 0, 0.2, 1)`. No bounce.

---

## Motion

Deliberate. Nothing bounces. Nothing spins for fun.

| Element             | Behavior                                                           | Duration                 |
| ------------------- | ------------------------------------------------------------------ | ------------------------ |
| Card deal           | Slides up `24px` + rotates `2deg → 0deg`, sharp deceleration       | `380ms`                  |
| Card flip (reveal)  | Front face fades in over a subtle Y-axis rotation                  | `300ms`                  |
| Modal open          | Fades in + translates up `16px`                                    | `240ms`                  |
| Modal close         | Fades out + translates down `8px`                                  | `160ms`                  |
| Toast               | Slides in from top, pauses `2.5s`, fades out                       | `200ms` in / `160ms` out |
| Player switcher     | Crossfade between active player name and pill highlight            | `180ms`                  |
| Draw button tap     | Single pulse of `--color-accent-green` on the border, then settles | `220ms`                  |
| Notifications badge | Scale pop `1.0 → 1.3 → 1.0` on count increment                     | `200ms`, once            |
| Screen transition   | Slide left (forward) / slide right (back), `12px` travel + fade    | `260ms`                  |

**Rules:**

- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions — fast out, gentle settle.
- No looping animations except the Draw button idle state: a very slow, barely-there violet border pulse (`4s` loop, 10% opacity swing).
- Only animate `transform` and `opacity`. Never animate `height`, `width`, `padding`, or `margin`.
- `prefers-reduced-motion`: all animations collapse to simple `opacity` fades at `150ms`. No translate, no rotate.

---

## Iconography

Thin-stroke icons only (`1.5px` stroke weight). No filled icons except for active and selected states.

Art deco motifs used sparingly as decorative elements — never as functional icons:

- `◆` Diamond separators between metadata items (author · game tag · spiciness)
- `«»` Chevron pairs instead of single arrows for navigation
- A stylized **C** or card-suit mark as the app logo

Functional icons (menu, notifications, vote, flag, transfer) are clean and geometric — no personality, just clarity. Size at `20px` with `4px` optical padding from adjacent text. The _surfaces_ carry the personality; the icons just do their job.

---

## Layout & Spacing

Art deco loves symmetry, geometry, and deliberate negative space.

**Spacing scale** (4px base): `4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64px`. No off-scale values.

- Minimum internal padding on cards and modals: `20px`.
- Section dividers: a 1px gold line (`--color-border`) or a geometric ornament — never bare whitespace alone.
- The Game screen is centered on the draw action. Everything else recedes into the periphery.
- Bottom-anchored primary actions (Draw, Save, Submit): full-width or near-full-width, `16px` from the safe area bottom. Heavy. Confident.
- Minimum touch target: `44×44px` on all interactive elements, even where the visual footprint is smaller.
- Safe area insets respected on all screens (Ionic / Capacitor on iOS and Android).

---

## Player Switcher

Chance is designed for a single shared phone passed around a table. The player switcher is the mechanism that makes that feel natural — it must be always present during an active session and instantly readable at a glance.

- Fixed to the top of the Game and Card screens; always in frame.
- Displays all players in the current session as a horizontal strip of compact name pills.
- The active player's pill: `--color-accent-primary` background, `--color-text-primary` label, slightly taller than inactive pills.
- Inactive players: `--color-surface-elevated` pill, `--color-text-secondary` label.
- Tapping any pill switches the active player (`180ms` crossfade). This must happen before the Draw button becomes enabled.
- The switcher is the gate. On a shared device, the Draw button is only enabled for the currently active player.

---

## The Draw Button

The most important element in the app. It gets special treatment.

- Large, nearly full-width, bottom-anchored. Height: `56px`.
- Dark surface (`--color-surface`) with a `1.5px` `--color-accent-primary` border that glows faintly in the idle state.
- **Idle:** violet border with a slow, barely-there breathing glow. Label: **DRAW**.
- **On tap:** border flashes `--color-accent-green` for `220ms`, then returns to violet. Card deal animation begins immediately.
- **Loading** (syncing in the background): border pulses violet at a `1s` interval. The card is already visible — this is background sync, not a blocker.
- **Disabled** (not the active player's turn): border dims to `--color-border`, label shifts to `--color-text-secondary`. No red, no warning — just absence.
- Label: **DRAW** — all caps, `0.15em` tracking, display face.

---

## States & Feedback

Every state needs a treatment. Blank screens and silent failures are not acceptable.

**Loading:**

- Use skeleton screens in the exact shape of the incoming content — not spinners.
- Skeleton color: `--color-surface-elevated` with a slow shimmer sweep (left to right, `1.5s` loop).
- The Draw button's border pulse is the only loading indicator during a draw — no overlay, no blocking modal.

**Empty states:**

- Name the empty state. "No cards drawn yet." Not a blank area.
- Include a quiet prompt toward the next action. Short, confident, not needy.
- Use the app logo mark as a dim decorative anchor — centered, `--color-border` fill.

**Error states:**

- Inline, not modal. Errors appear where the failure happened.
- Copy is dry: **"That didn't work."** followed by a text-link retry: **"Try again."**
- Connection loss: `NetworkStatusBanner` — a slim bar at the top of the screen, `--color-accent-amber` background, dark text. Not alarming. Informational.
- Sync failures on individual cards: a small `FAILED` badge (`--color-danger`, all caps, `--text-label` scale) in the card corner. Tap opens a compact action sheet: **Retry** or **Discard**.

**Success:**

- Most successes are silent — the UI just reflects the new state. No toasts for expected outcomes.
- Exceptions: card submission confirmed, card transfer accepted. These get a brief toast.
- Toasts: dark surface, thin amber border, icon + one line of copy. They arrive fast and leave faster.

---

## Voice & Copy

Short. Confident. Slightly knowing.

| Say this                                | Not this                                       |
| --------------------------------------- | ---------------------------------------------- |
| **Draw**                                | "Draw a card"                                  |
| **End game**                            | "End game session"                             |
| **Your turn**                           | "It is currently your turn to draw"            |
| **Resolved**                            | "This card has been marked as resolved"        |
| **Something changed** _(filter update)_ | "Session filter settings have been updated"    |
| **That didn't work.** _(error)_         | "An error occurred. Please try again later."   |
| **Waiting for {Name}**                  | "It is {Name}'s turn to draw a card"           |
| **{Name} passed the card** _(transfer)_ | "A card transfer has been initiated by {Name}" |

The app knows what it is. It doesn't over-explain. Periods on complete sentences, not on labels.

---

## What It Is Not

- **Not a casino.** No chips, no spin animations, no jackpot energy.
- **Not a children's app.** No primary colors, no rounded bubbly type, no confetti.
- **Not trying to be Dribbble.** No glassmorphism, no mesh gradients, no floating blobs.
- **Not dark mode as a trend.** Dark because that's the only mode — darkness is the environment, not the aesthetic.
- **Not an app that explains itself.** Trust the player. No onboarding tooltips, no coach marks, no feature callouts.

---

## What It Is

A quiet room that gets louder the longer you stay. Surfaces that earn attention. A card that means something when it lands. A phone that feels just right to pass across the table.

Design accordingly.
