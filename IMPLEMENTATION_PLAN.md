# Chance — Implementation Plan

> Track feature progress across sessions. Update ✅ / ⬜ as work completes.
> Read alongside `CLAUDE.md` (architecture) and `CHANCE_UX_DECISIONS.md` (spec).

---

## Orientation for a new session

**Current phase:** Frontend-only. All API calls run against the fake client. Backend is not connected and no API routes are implemented yet. Focus is on getting the full mobile UX built and working end-to-end with fake data before wiring the real backend.

**Running the app:** `pnpm --filter mobile dev` starts Vite on port 8100. Set `VITE_USE_FAKE_API=true` in `apps/mobile/.env.local` to use the fake API — required for all current development since the backend isn't running.

**Reference implementation:** `GameSettings.tsx` is the canonical example for a full form page — page structure, section layout, toggle rows, tag chips, footer pattern, and style conventions. Mirror it when building new form pages.

**Established style patterns:**

- All styles are inline via `const styles: Record<string, React.CSSProperties>` at the bottom of each file
- CSS custom properties live in `apps/mobile/src/theme/variables.css` — always use tokens (`--color-bg`, `--font-display`, `--space-5`, etc.), never raw values
- Display face (`--font-display`) for headings and card titles only; UI face (`--font-ui`) for everything else
- `GameSettings.tsx` and `AppMenu.tsx` are the best references for the dark neon-speakeasy aesthetic in practice

**Schema notes (diverge from earlier design docs):**

- `CardVersion` and `SubmitCardRequest` use `drinksPerHourThisPlayer: number` and `avgDrinksPerHourAllPlayers: number` — there is no `isDrinking: boolean` field anywhere
- `CardVersion` and `SubmitCardRequest` include `isGameChanger: boolean`

---

## Implementation status

### Infrastructure & shared

| Area                               | Status | Notes                                                             |
| ---------------------------------- | ------ | ----------------------------------------------------------------- |
| Monorepo / Turbo / pnpm workspaces | ✅     |                                                                   |
| `packages/core` — Zod schemas      | ✅     | Card, Session, Player, DrawEvent, CardTransfer, User, api schemas |
| `packages/core` — AppError types   | ✅     |                                                                   |
| `packages/core` — constants        | ✅     |                                                                   |
| Fake API client (`FakeApiClient`)  | ✅     | All methods stubbed; toggled via `VITE_USE_FAKE_API`              |
| Real API client (`RealApiClient`)  | ✅     | Methods written; no backend to hit yet                            |
| `ApiClient` interface              | ✅     |                                                                   |
| `AuthContext`                      | ✅     | login, register, logout, guest session, upgrade-from-guest        |
| `SessionContext`                   | ✅     | session state, players, active player, device player list         |
| `CardContext`                      | ✅     | draw history; `addDrawEvent`, `updateDrawEvent`, `clearHistory`   |
| `TransferContext`                  | ✅     | pending transfers                                                 |
| `AppHeaderContext`                 | ✅     | title and back-button state                                       |
| `NetworkStatusBanner`              | ✅     | shows when Capacitor reports offline                              |
| `AppErrorBoundary`                 | ✅     |                                                                   |
| `playerTokenStore`                 | ✅     | Capacitor Preferences wrapper for guest player token              |
| `haptics` util                     | ✅     |                                                                   |
| Routing / `App.tsx`                | ✅     | All routes registered; lazy-loaded with PageSkeleton              |

### Navigation & shell

| Area                  | Status | Notes                                  |
| --------------------- | ------ | -------------------------------------- |
| `AppHeader` component | ✅     | Menu toggle or back button, page title |
| `AppMenu` side drawer | ✅     | Auth-conditional nav sections          |

### Auth screens

| Area                                    | Status | Notes                |
| --------------------------------------- | ------ | -------------------- |
| Login page (`/login`)                   | ✅     |                      |
| Register page (`/register`)             | ✅     |                      |
| Invite request page (`/invite-request`) | ⬜     | Stub — "coming soon" |
| About / What is Chance page (`/about`)  | ⬜     | Stub — "coming soon" |

### Home

| Area            | Status | Notes                                            |
| --------------- | ------ | ------------------------------------------------ |
| Home page (`/`) | ✅     | Create game + Join game entry points, auth-aware |

### Game session creation

| Area                                                    | Status | Notes                                             |
| ------------------------------------------------------- | ------ | ------------------------------------------------- |
| Game Settings page (`/game-settings`)                   | ✅     | Create mode: name, filters, card sharing, tags    |
| Game Settings — edit mode (`/game-settings/:sessionId`) | ✅     | Reuses same page; player list with identity reset |

### Joining a session

| Area                                  | Status | Notes                                     |
| ------------------------------------- | ------ | ----------------------------------------- |
| Join page (`/join/:code?`)            | ✅     | Code entry → name entry → guest join flow |
| Fuzzy name match / token rejoin logic | ✅     | Client-side; wired through fake API       |

### Game screen (`/game/:sessionId`)

| Area                                               | Status | Notes                                                      |
| -------------------------------------------------- | ------ | ---------------------------------------------------------- |
| Game page shell                                    | ✅     |                                                            |
| Persistent player switcher                         | ✅     |                                                            |
| Draw button (idle glow, tap flash, disabled state) | ✅     |                                                            |
| Full-screen card reveal overlay                    | ✅     |                                                            |
| Hidden description toggle / Share description      | ✅     |                                                            |
| Game Changer dramatic intro sequence               | ✅     | Badge + delayed slow flip implemented; audio cue pending   |
| Join code / QR share (in-game)                     | ✅     | Join code only — QR deferred                               |
| Add player to device modal                         | ✅     | joinByCode flow; playerToken saved; switches active player |
| Background sync indicator (draw loading state)     | ⬜     |                                                            |

### Card submission

| Area                              | Status | Notes                                                                                         |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| Submit card page (`/submit-card`) | ✅     | Title, description, hiddenDescription, drinking rates, game tags, isFamilySafe, isGameChanger |
| Outside-session submission path   | ✅     | Routes to `submitCardOutsideSession` → `POST /api/cards` (backend endpoint TBD)               |

### Game history (`/history/:sessionId`)

> **Note:** This page is for viewing **ended or past sessions** only (accessible from "My games" in the side menu, or navigated to after a session ends). It is NOT where active-game card history lives — during an active session, the card history carousel and detail overlay are part of the Game screen (`/game/:sessionId`) itself.

| Area                               | Status | Notes                                                      |
| ---------------------------------- | ------ | ---------------------------------------------------------- |
| Game History page shell            | ⬜     | Stub — "coming soon" — for past/ended sessions only        |
| Card history list (version-locked) | ⬜     |                                                            |
| Card detail modal (read-only)      | ⬜     |                                                            |
| Flag                               | ⬜     |                                                            |

### Game screen — card interactions (live, in `/game/:sessionId`)

> These features live in the active Game screen's card carousel and `CardDetailOverlay`, not in Game History.

| Area                                    | Status | Notes                                             |
| --------------------------------------- | ------ | ------------------------------------------------- |
| Card history carousel                   | ✅     | Newest-first; resolved cards dimmed at 0.55 opacity |
| Show/hide resolved toggle               | ✅     |                                                   |
| Card detail overlay (tap to open)       | ✅     |                                                   |
| Vote up / Vote down (separate buttons)  | ✅     | Tap active button again to clear vote             |
| Resolve / unresolve (explicit, any player) | ✅  | Direct toggle, no host approval, no notification  |
| Request card transfer                   | ✅     | Opens player picker; wired to fake API            |
| Share hidden description                | ✅     | Drawer only                                       |
| Flag                                    | ⬜     | Stub in UI                                        |

### Notifications

| Area                               | Status | Notes                                        |
| ---------------------------------- | ------ | -------------------------------------------- |
| Notifications modal (side menu)    | ⬜     |                                              |
| Transfer requests — accept / reject inline | ⬜ |                                           |
| Notification badge count           | ⬜     |                                              |

### My Cards (`/cards`)

| Area                                | Status | Notes                 |
| ----------------------------------- | ------ | --------------------- |
| My Cards page                       | ✅     | Marked "soon" in menu |
| My cards tab (own submissions)      | ✅     |                       |
| All cards tab (admin only)          | ⬜     |                       |
| Card detail — editable view         | ✅     |                       |
| Version history (read-only)         | ⬜     |                       |
| Deactivate card                     | ✅     |                       |
| Admin: promote / demote global pool | ⬜     |                       |

### Account / settings

| Area                            | Status | Notes                                      |
| ------------------------------- | ------ | ------------------------------------------ |
| App Settings page (`/settings`) | ✅     | Display name, email, password change modal |

### Offline / sync

| Area                                                     | Status | Notes                                                   |
| -------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `MutationQueue` (Capacitor Preferences, retry + backoff) | ⬜     | Spec'd in tech overview; not implemented                |
| `syncStatus` on local entity records                     | ⬜     |                                                         |
| `PendingSyncIndicator` in side menu                      | ⬜     |                                                         |
| `Idempotency-Key` header on mutations                    | ⬜     | Backend concern; client sends key when backend is wired |

### Backend (`apps/backend`) — deferred

All backend work is out of scope for the current phase. The real API client has method stubs that will call the correct endpoints once the backend exists.
