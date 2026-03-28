# Chance — Technical Overview & Design Document

> Version 0.1 · Draft

---

## What is Chance?

Chance is a social party app that acts as a live companion layer on top of physical board games. When an in-game event triggers a "Chance" moment, the active player draws a card from a shared, ever-growing pool contributed by all players across all sessions. Cards carry effects like dares, drinking mechanics, and conversation prompts — filtered per session by age-appropriateness, drinking preference, and game compatibility.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Shared Core Package](#3-shared-core-package)
4. [Backend](#4-backend)
5. [Mobile App](#5-mobile-app)
6. [API Design: Offline-First & Connection Awareness](#6-api-design-offline-first--connection-awareness)
7. [Cross-Cutting Patterns](#7-cross-cutting-patterns)
8. [Environment & Configuration](#8-environment--configuration)
9. [MVP Scope & Future Considerations](#9-mvp-scope--future-considerations)

---

## 1. Product Overview

### 1.1 Core Concept

Chance runs alongside any board game — Settlers of Catan, Ticket to Ride, or any other — and enriches it with a digital card-draw mechanic. When a physical game event triggers a Chance moment (e.g. rolling a specific number, landing on a space, losing a round), the current player draws a card. The card is revealed privately first, then visible to the rest of the session after a short delay.

Chance is designed for shared, in-person play. **A single phone is all that's needed** — the registered host creates the session, and other players join as ephemeral guests by entering only a display name. The phone is passed to whichever player is taking their turn. Players who do have their own devices can also join and follow along simultaneously; both modes are fully supported.

The card pool is the heart of the app. It is seeded from a global community database and grows richer every session as players submit their own cards. Cards drawn in the current session are weighted more heavily in the draw algorithm, giving each group a personalized experience that evolves over time.

### 1.2 Key Differentiators

- **Session-first design:** guest mode for non-host players; only registered users can host/initiate sessions
- **Single-device play:** the whole group can play on one shared phone — the registered host starts the session, other players join as ephemeral guests (display name only), and the phone is passed to whoever is taking their turn
- **Ephemeral guests:** guest players need no account or app install — they enter a display name to join and receive a session-scoped JWT; their identity does not persist beyond the session
- **In-session account claiming:** a guest can log in or register at any time during a session; their ephemeral guest identity is merged into their real account and play continues uninterrupted — votes, draws, and submissions already made are preserved under the claimed account
- **Invite-only registration:** accounts require an invitation code issued by an admin; controls growth and community quality
- **Living card pool:** draw pool assembled from four tiers — global (admin-curated), game-lineage (cards from past sessions of the same game type, mediated by player sharing settings), player libraries (cards from registered players present in the session), and this-session submissions (3× boost). Strangers' cards never enter your game unless mediated by a player you're playing with.
- **Cooperative card transfer:** either player in a session can offer a card to another; recipient accepts or rejects
- **Flexible game tagging:** cards can be associated with one or more real-world games, or tagged as universally applicable
- **Community moderation:** upvote/downvote and flagging feed back into card draw weight and admin review queue

### 1.3 Access Model

| User Type         | Registration                | Can Host Session | Can Join Session | Can Submit Cards | Persistent Account           |
| ----------------- | --------------------------- | ---------------- | ---------------- | ---------------- | ---------------------------- |
| Registered        | Requires invitation code    | ✅               | ✅               | ✅               | ✅                           |
| Guest (ephemeral) | Display name only (no code) | ❌               | ✅               | ❌               | ❌ — session-scoped JWT only |
| Admin             | Registered + admin scope    | ✅               | ✅               | ✅               | ✅                           |

> **Note on guest ephemerality:** Guest JWTs are issued per session and are not stored in persistent secure storage. A guest's display name and session-player record exist for the lifetime of the session only. Votes made by a guest are attributed to their `player_id`. Guests cannot submit cards — card authorship requires a persistent `user_id`.

### 1.4 Platform

- Android and iOS (Ionic/Capacitor)
- Backend: Next.js API + admin portal (SQLite via better-sqlite3)
- Guest and registered user modes; registered-only session hosting
- Single-device play is the primary use case: one phone shared by the whole group, passed to the active player on each turn

---

## 2. Monorepo Structure

```
root/
├── apps/
│   ├── backend/        # Next.js App Router API + admin portal
│   └── mobile/         # Ionic/Capacitor React app (Android + iOS)
├── packages/
│   └── core/           # Shared Zod schemas, error types, constants
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 2.1 Tooling

| Tool                | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| pnpm workspaces     | Package manager and workspace linking                                                     |
| Turborepo           | Task pipeline with caching (build → test → lint → typecheck)                              |
| TypeScript (strict) | Shared across all packages and apps                                                       |
| Prettier            | Consistent code formatting                                                                |
| Zod                 | Schema definition in `core`; used for API validation, form validation, and type inference |

### 2.2 Turbo Pipeline

| Task        | Depends On                         |
| ----------- | ---------------------------------- |
| `build`     | `^build` (upstream packages first) |
| `test`      | `build`                            |
| `lint`      | `^build`                           |
| `typecheck` | `^build`                           |

---

## 3. Shared Core Package

The `core` package is consumed by both `backend` and `mobile`. It is the single source of truth for domain types, validation logic, and shared constants.

### 3.1 Schemas (`src/schemas/`)

Zod schemas for all Chance domain entities. Used for runtime validation and TypeScript type inference across both apps.

| Schema                     | Description                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CardSchema`               | Content, game tags (array — one or more games, or empty for universal), drinking flag, family-safe flag, spiciness level, author, upvotes, downvotes, flag count |
| `SessionSchema`            | Session ID, host (registered user), players, filter settings, active card pool, status                                                                           |
| `PlayerSchema`             | Player ID, display name, guest flag, account link                                                                                                                |
| `CardTransferSchema`       | Initiator, recipient, card reference, draw event reference, status (pending / accepted / rejected)                                                               |
| `DrawEventSchema`          | Session, player, drawn card, timestamp, visibility state (private / revealed)                                                                                    |
| `FilterSettingsSchema`     | Age-appropriate toggle, drinking toggle, game tag filter (array — any of these games, or all-games)                                                              |
| `VoteSchema`               | Player, card, direction (up / down) or flag                                                                                                                      |
| `InvitationCodeSchema`     | Code string, created by (admin user), used by (user, nullable), expires at (nullable), active flag                                                               |

### 3.2 Errors (`src/errors/`)

`AppError` base class extended by: `AuthenticationError`, `AuthorizationError`, `ValidationError`, `NotFoundError`, `ConflictError`, `InvitationCodeError`. All errors carry a `code`, `message`, and optional `details` field.

### 3.3 Constants (`src/constants/`)

- Text length limits for card content, display names, session names
- Token TTL defaults for JWT access and refresh tokens
- Card weight constants: session-card boost multiplier (default `3.0×`), vote weight deltas, recently-drawn suppression factor
- Reveal delay constant: time before a drawn card becomes visible to all players (default `3000ms`)
- Session poll intervals: active foreground (`5000ms`), backgrounded (`30000ms`)
- Request timeout (`15000ms`), health check endpoint (`/api/health`)
- Invitation code length and character set

---

## 4. Backend

**Stack:** Next.js 15 (App Router), React 19, better-sqlite3, TypeScript

### 4.1 Directory Layout

```
apps/backend/src/
├── app/
│   ├── api/
│   │   ├── auth/               # register (with invite code), login, refresh, logout
│   │   ├── invitations/        # validate code (public); CRUD (admin only)
│   │   ├── sessions/           # create (registered only), join, end, poll state
│   │   ├── cards/              # submit, draw, vote, flag
│   │   ├── transfers/          # initiate and respond to card transfers
│   │   └── health/             # GET /api/health — lightweight connectivity probe
│   └── admin/                  # Admin portal (Mantine UI)
│       ├── cards/              # Review flagged cards, manage pool, seed cards
│       ├── invitations/        # Create, deactivate, view usage of invite codes
│       ├── users/              # Account management
│       └── analytics/          # Card popularity, play counts, session volume
├── lib/
│   ├── auth/                   # JWT, bcryptjs, withAuth HOF, withAdmin HOF, rate limiting
│   ├── db/                     # SQLite singleton + migrations + seeding
│   ├── repos/                  # One repo class per entity
│   ├── services/               # Business logic and orchestration
│   ├── card-picker/            # Weighted draw algorithm
│   └── admin/                  # Admin session management
└── middleware.ts                # CORS, security headers, HTTPS redirect
```

### 4.2 Request Lifecycle

```
HTTP Request
  → middleware.ts (CORS, security headers, HTTPS enforcement)
  → app/api/**/route.ts (Zod input validation, withAuth / withAdmin HOF)
  → lib/services/*.ts (business logic, orchestration)
  → lib/repos/*.ts (SQL via prepared statements)
  → better-sqlite3 (synchronous SQLite)
  → JSON response
```

### 4.3 Database Schema

Engine: SQLite via `better-sqlite3`. Foreign key constraints enforced (`PRAGMA foreign_keys = ON`). Boolean values bridged with `boolToInt`/`intToBool` helpers. Migrations are timestamp-named files applied in order by a migration runner script.

| Table              | Key Columns / Notes                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`            | `id`, `email`, `password_hash`, `display_name`, `is_admin`, `invitation_code_id` (FK), `created_at`                                                |
| `invitation_codes` | `id`, `code` (unique), `created_by_user_id` (FK, admin), `used_by_user_id` (FK, nullable), `expires_at` (nullable), `is_active`                    |
| `sessions`         | `id`, `host_user_id` (FK, registered users only), `join_code`, `qr_token`, `filter_settings` (JSON), `status`, `created_at`                        |
| `session_players`  | `session_id`, `user_id`, `joined_at`, `card_sharing TEXT DEFAULT 'network' CHECK(IN ('none','mine','network'))` — join table                        |
| `cards`            | `id`, `content`, `author_id` (FK → users, **never null**), `is_global INTEGER DEFAULT 0`, `created_in_session_id` (FK → sessions, nullable), `is_drinking`, `spiciness_level`, `is_family_safe`, `upvotes`, `downvotes`, `active`, `created_at` |
| `card_game_tags`   | `card_id`, `game_name` — one row per game association; cards with no rows here are universal                                                       |
| `draw_events`      | `id`, `session_id`, `player_id`, `card_id`, `drawn_at`, `revealed_to_all_at` (nullable)                                                            |
| `card_votes`       | `player_id`, `card_id`, `vote` (up/down), `created_at`                                                                                             |
| `card_transfers`   | `id`, `from_player_id`, `to_player_id`, `card_id`, `draw_event_id`, `status`, `created_at`                                                         |
| `refresh_tokens`   | `id`, `user_id`, `token_hash`, `expires_at`, `revoked`                                                                                             |

**Notes on `card_game_tags`:** A card with zero rows in `card_game_tags` is treated as universally applicable (equivalent to "Any Game"). A card with one or more rows is only eligible for sessions filtered to one of those games, or sessions with no game filter set. This is enforced in the card-picker service at draw time and in the API validation layer on card submission.

**Required indexes for card-picker performance:**
- `cards(is_global, active)` — global tier scan
- `cards(created_in_session_id, active)` — game-lineage + this-session tier scan
- `session_players(session_id, card_sharing)` — player-library tier join
- `session_players(user_id)` — resolving a player's past sessions for the network tier

### 4.4 Invitation Code System

- Admin users create invitation codes via the admin portal or `POST /api/invitations` (admin-scoped)
- Codes can optionally carry an expiry date; unexpired, unused, active codes are valid for registration
- `POST /api/auth/register` accepts `{ email, password, displayName, invitationCode }`
- The backend validates the code, creates the user, and marks the code as used (sets `used_by_user_id`)
- A single code is single-use only — once consumed it cannot be reused
- Admins can deactivate codes at any time (sets `is_active = false`)
- The admin portal shows code usage: who created it, when it was used, and by which account

### 4.5 Weighted Card Draw Algorithm

The card-picker service assembles a pool from four eligibility tiers, selects a winner via weighted random, then fetches the full card content. Weights are computed at draw time and are not persisted. A card must have `active = true` and pass session filters (drinking, age, game tag) to qualify in any tier.

#### Pool tiers

| Tier | Condition | Base weight |
|---|---|---|
| **This-session** | `cards.created_in_session_id = currentSessionId` | `3.0×` |
| **Game-lineage** | `created_in_session_id IS NOT NULL` AND at least one player in the session has `card_sharing = 'network'` AND participated in that origin session AND that card's author had `card_sharing != 'none'` in that session | `1.0` |
| **Player library** | `author_id` links to a player in this session with `card_sharing IN ('mine','network')` | `1.0` |
| **Global** | `is_global = 1` | `1.0` |

"Recent sessions" for the game-lineage tier is bounded by `RECENT_GAMES_WINDOW` (constant in `packages/core/src/constants/`). Cards qualifying under multiple tiers use the highest base weight.

#### Two-step selection (avoids loading full card content for the entire pool)

**Step 1 — fetch IDs + weight inputs only** (three indexed queries):
```sql
-- Global tier
SELECT id, upvotes, downvotes FROM cards
WHERE is_global = 1 AND active = 1 AND <game tag filter>

-- This-session + game-lineage tiers
SELECT id, upvotes, downvotes,
       CASE WHEN created_in_session_id = :sessionId THEN 'current' ELSE 'network' END AS tier
FROM cards
WHERE created_in_session_id IN (:currentSessionId, :recentSessionIds...)
  AND active = 1 AND <game tag filter>
  -- network rows additionally filtered to authors who were sharing in those sessions

-- Player-library tier
SELECT c.id, c.upvotes, c.downvotes
FROM cards c
JOIN session_players sp ON sp.user_id = c.author_id
WHERE sp.session_id = :sessionId AND sp.card_sharing != 'none'
  AND c.active = 1 AND <game tag filter>
```

**Step 2 — weighted selection in the card-picker service (JS):**
Deduplicate card IDs (keep highest-priority tier), apply tier base weight + modifier stack, weighted random draw:
- Upvote bonus: `+0.2` per net upvote (upvotes − downvotes), capped at `+2.0`
- Downvote penalty: net negative votes → `0.5×`
- Recently drawn suppression: drawn in the last N draws → `0.1×`

**Step 3 — fetch winner's full content:**
```sql
SELECT c.*, cv.*
FROM cards c JOIN card_versions cv ON cv.id = c.current_version_id
WHERE c.id = :winnerId
```

### 4.6 API Design

#### Response Envelope

Every API response — success or failure — uses a consistent envelope:

```typescript
// Success
{
  ok: true,
  data: T,
  serverTimestamp: string   // ISO 8601 — used as the `since` cursor for session polling
}

// Failure
{
  ok: false,
  error: {
    code: string,           // AppError code from core
    message: string,
    details?: unknown
  },
  serverTimestamp: string
}
```

`GET /api/health` returns `{ ok: true, ts: "<ISO timestamp>" }` with no auth requirement and no database access — pure liveness check.

### 4.7 Session & Join Flow

- Only registered users can call `POST /api/sessions` (enforced by `withAuth` + registered-user check)
- Backend generates a short alphanumeric join code and a QR token
- Guest players supply a display name; receive a session-scoped guest JWT (no email or password required); guest JWTs are ephemeral — not stored in persistent secure storage
- Registered users authenticate normally; their account is linked to the session player record
- **Single-device play:** multiple players — including a mix of one registered host and several ephemeral guests — can all participate from the same device. Each player identifies themselves via the active-player selector on the Game screen. The phone is passed between players as turns change; no separate devices are required
- Session state (player list, drawn cards, pending transfers) is polled by mobile clients — no persistent WebSocket required at MVP

### 4.8 Card Transfer Flow

- Either player `POST /api/transfers` with `draw_event_id` and `to_player_id`
- A `card_transfers` record is created with `status = pending`
- Recipient's device picks up the pending transfer on its next poll cycle
- Recipient `PATCH /api/transfers/:id` with `{ status: "accepted" | "rejected" }`
- On acceptance, the draw event is logically reassigned to the recipient for display purposes

### 4.9 Authentication

- JWT access token (short TTL) + refresh token stored in the `refresh_tokens` table
- `withAuth` HOF validates any JWT — guest or registered. Most gameplay routes (`draw`, `vote`, `submit card`, `transfer`) only require `withAuth`
- `withAuth` + registered-user check gates the small number of routes that require a persistent account (e.g. `POST /api/sessions`)
- `withAdmin` additionally checks `is_admin`; used only for admin portal API routes
- Guest mode: lightweight session-scoped JWT issued on display-name entry; no email or password; not stored in persistent secure storage
- `X-Token-Status` response header signals token validity to the mobile client
- Rate limiting on login, guest-register, and invitation-validate endpoints

#### In-Session Account Claiming

A guest player can log in or register at any time while a session is active. The claim flow:

1. Guest taps "Log in" or "Create account" from within the session UI
2. The app presents the login/register screen in a modal or sheet — the session remains active in the background
3. On successful authentication, the client calls `POST /api/auth/claim` with the guest JWT in the `Authorization` header and the registered user credentials in the body
4. The backend atomically:
   - Authenticates the registered user (or completes registration)
   - Sets `session_players.user_id` to the registered user's ID for the guest's existing player record
   - Issues a new registered-user JWT pair (access + refresh)
5. The client replaces the guest JWT with the new tokens and updates `AuthContext` — play continues without interruption
6. All prior activity (draws, votes, card submissions) attributed to the guest `player_id` is now associated with the real account

**Constraints:**
- If the registered user is already present in the session as a registered player, the claim is rejected (`409 Conflict`)
- `POST /api/auth/claim` requires a valid guest JWT; calling it with a registered JWT is a no-op error
- Registration-via-claim follows the same invitation code requirement as normal registration

### 4.10 Security Headers (middleware)

Applied globally: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`.

### 4.11 Admin Portal

Built with Mantine UI inside the Next.js app at `/admin`. Protected by a separate admin session (not user JWT). Admin scope is stored on the `users` table (`is_admin` flag).

- **Invitation codes:** create single-use codes with optional expiry; view usage history; deactivate codes
- **User management:** view accounts, deactivate users, promote to admin
- **Analytics:** card play counts, upvote/downvote ratios, top cards by game tag, session volume over time

Card management (global pool curation, card deactivation, flag review) lives in the mobile app under My Cards → All cards, accessible to admin-scoped users only.

---

## 5. Mobile App

**Stack:** Ionic 8, Capacitor 8, React 19, Vite 6, TypeScript

### 5.1 Directory Layout

```
apps/mobile/src/
├── App.tsx                    # Provider stack + routing
├── auth/                      # AuthContext, AuthProvider, useAuth
├── session/                   # SessionContext, provider, useSession hook
├── cards/                     # CardContext, draw logic, card display
├── transfers/                 # TransferContext, pending transfer handling
├── db/                        # DatabaseContext (SQLite), React Query client
├── lib/
│   ├── api/
│   │   ├── client.ts          # ApiClient singleton
│   │   └── connectionProbe.ts # Health-check based connectivity detection
│   └── mutationQueue.ts       # Offline mutation queue with persistence
├── hooks/
│   ├── useNetworkStatus.ts    # Online/offline state + connection probe
│   ├── useSessionPoll.ts      # Interval-based session state polling
│   ├── useCardDraw.ts         # Draw orchestration with optimistic update
│   └── useOptimisticMutation.ts # Generic optimistic mutation + queue hook
├── pages/
│   ├── Home.tsx               # Landing: create (registered) or join session
│   ├── Lobby.tsx              # Pre-game player list + filter setup (host)
│   ├── Game.tsx               # Active session: draw button, card history
│   ├── CardDetail.tsx         # Full-screen card reveal + vote/flag/transfer
│   ├── CardSubmit.tsx         # Submit a new card to the session pool
│   ├── Login.tsx
│   ├── Register.tsx           # Includes invitation code field
│   └── Settings.tsx
├── components/
│   ├── cards/                 # CardReveal, CardHistory, CardTransferModal, SyncStatusBadge
│   ├── session/               # PlayerList, FilterSetup, JoinCode, QRScanner
│   ├── form/                  # FormTextInput, FormPasswordInput
│   ├── layout/                # Header, SideMenu, Navigation
│   └── shared/                # NetworkStatusBanner, AppErrorBoundary, PendingSyncIndicator
├── animations/                # Motion presets (card flip, reveal, slide)
└── theme/                     # SCSS design tokens
```

### 5.2 Provider Stack

```
AuthProvider
  DatabaseProvider       (SQLite + React Query client)
    SessionProvider
      CardProvider
        TransferProvider
          AppHeaderProvider
            AppErrorBoundary
              IonReactRouter
                Routes
```

### 5.3 Routing

React Router v5. Most of the app is reachable with any valid JWT — including an ephemeral guest JWT. The three access tiers are:

- **Open** — no JWT required
- **Session member** — any valid JWT (guest or registered) plus active session membership; redirects to `/` if no session is active
- **Registered only** — non-guest JWT required; redirects to `/login`

| Route                     | Access           | Description                                                     |
| ------------------------- | ---------------- | --------------------------------------------------------------- |
| `/`                       | Open             | Home — join session (all) or create session (registered only)   |
| `/login`                  | Open             | Registered user login; if a guest JWT is active, completing login triggers the claim flow instead of a normal session start |
| `/register`               | Open             | Account registration (requires invitation code); same claim-flow behaviour as `/login` when a guest JWT is active |
| `/join/:code`             | Open             | Direct join link; prompts for display name if no JWT            |
| `/lobby/:sessionId`       | Session member   | Pre-game lobby — player list, filter setup (host only), start   |
| `/game/:sessionId`        | Session member   | Active game — draw button, card history, transfer notifications |
| `/card/:drawEventId`      | Session member   | Full-screen card detail — vote/flag/transfer actions            |
| `/submit-card/:sessionId` | Session member   | Submit a new card to the current session pool                   |
| `/settings`               | Registered only  | Account settings, display name                                  |

### 5.4 State Management

| Concern                       | Mechanism                                                              |
| ----------------------------- | ---------------------------------------------------------------------- |
| Server state (queries, cache) | TanStack React Query — in-memory only; stale: 2 min, GC: 10 min       |
| Authentication state          | `AuthContext` — tokens, user object, guest flag, login/logout          |
| Session state                 | `SessionContext` — session metadata, player list, filter settings      |
| Card state                    | `CardContext` — active pool, draw history                              |
| Transfer state                | `TransferContext` — pending incoming/outgoing transfers                |
| Header/nav state              | `AppHeaderContext`                                                     |

### 5.5 Error Handling Strategy

Mutations are sent directly to the server with no local write-ahead or retry queue. On failure the UI surfaces the error inline and the user can try again manually.

- `ApiClient` returns a typed `ApiResult<T>` discriminated union — never throws
- Network errors (`status: null`) and server errors (`status: number`) are both surfaced the same way: an inline error message near the triggering action
- `NetworkStatusBanner` appears when the Capacitor Network plugin reports the device is offline; interactive elements that require network are disabled
- Session polls are paused while offline and resume automatically on reconnect

### 5.6 Network Awareness

Online/offline state is tracked via the Capacitor Network plugin in `useNetworkStatus`. No connection probe is run.

`ApiError` fields:

| Field            | Type             | Description                                 |
| ---------------- | ---------------- | ------------------------------------------- |
| `status`         | `number \| null` | HTTP status code, or `null` on network loss |
| `code`           | `string`         | AppError code from core                     |
| `message`        | `string`         | Human-readable message                      |
| `tokenStatus`    | `string \| null` | Value of `X-Token-Status` header if present |
| `isNetworkError` | `boolean`        | `true` when `status` is `null`              |

### 5.7 Session Polling

- Active game screen polls the session endpoint every 5 seconds (driven by React Query `refetchInterval`)
- Poll interval backs off to 30 seconds when the app is backgrounded (Capacitor App state events)
- Draw events become visible to all players after `REVEAL_DELAY` (default `3000ms`, constant in `core`)
- Transfer notifications are surfaced from the polling response
- Polls are paused while the device is offline (per `useNetworkStatus`) and resume automatically on reconnect

### 5.8 Card Draw Flow

```
1. Active player selects their name from the player selector (or it is pre-selected on their own device)
2. 'Draw' button is enabled only for the active player's turn
3. Player taps Draw
4. POST /api/sessions/:id/draw — button shows loading state during the request
5. On success: card-flip animation plays; card content shown in private view
6. On failure: error shown inline; player can try again
7. After REVEAL_DELAY, server sets draw_event.revealed_to_all_at
8. On separate devices: other players see the card on their next poll cycle
   On a shared device: the card appears in the session history, visible when the phone is passed to the next player
```

### 5.9 Card Transfer Flow

- Either player taps "Transfer Card" on the `CardDetail` screen
- A player picker modal lists current session players (excluding self)
- `POST /api/transfers` fires; button shows loading state
- On success: confirmation shown; recipient sees a transfer notification on their next poll cycle
- Recipient taps the notification to open `CardTransferModal`: accept or reject
- Accept/reject calls `PATCH /api/transfers/:id`; error shown inline on failure

### 5.10 Session Setup & Filter Configuration (Host)

Before the game begins, the host configures the session in the Lobby screen:

- **Age-appropriate toggle:** excludes cards where `is_family_safe = false`
- **Drinking toggle:** excludes cards where `is_drinking = true` when disabled
- **Game tag selector:** host picks one or more real-world games, or leaves as "Any Game"; only cards tagged for one of those games (or universally tagged) are included in the draw pool

These settings are saved to the `sessions.filter_settings` JSON column and enforced server-side at draw time. The filter settings schema is defined in `core` and validated by Zod on both client and server.

### 5.11 Card Submission

Any player in an active session can submit a card. Required fields: content, game tag(s) or "universal", drinking flag, family-safe flag.

- `POST /api/cards` fires on submit; form shows loading state
- On success: card is added to the session pool and becomes immediately eligible for draw; `submitted_in_session = true` enables the session-card draw boost
- On failure: error shown inline; form stays populated so the player can retry

### 5.12 Local Storage Strategy

| Data                                           | Storage                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| JWT access + refresh tokens (registered users) | Capacitor Secure Storage (encrypted native keychain)                                             |
| Guest JWTs                                     | In-memory only — ephemeral, not persisted; cleared when the session ends or the app is restarted |
| API URL override                               | Capacitor Preferences                                                                            |
| Active player identity (shared-device mode)    | In-memory session state (`SessionContext`)                                                       |

### 5.13 API Client (`lib/api/client.ts`)

Singleton `ApiClient` class:

- Base URL resolved from: `VITE_API_URL` env → Capacitor Preferences override → platform defaults (Android emulator, web dev, production)
- 15-second request timeout via `AbortController`
- On `401` with `X-Token-Status: invalid` — refreshes tokens and replays original request once
- Returns typed `ApiResult<T>` (discriminated union of success/failure) — never throws

### 5.14 Loading & Transition Strategy

Chance uses a two-tier loading model. Manual `isLoading` flags, disabled forms, and per-button loading spinners are avoided throughout.

#### Tier 1 — Initial route load: `useSuspenseQuery` + Suspense fallback

All data fetching uses TanStack Query's `useSuspenseQuery`. On the first visit to a route (no cached data), the component suspends and the nearest Suspense boundary renders a layout-accurate page skeleton. Once data is in the React Query cache, subsequent re-fetches (including session polls) **never re-suspend** — the cached data stays on screen seamlessly.

```
First visit to /game/:id
  └─ useSuspenseQuery suspends
       └─ <Suspense fallback={<GamePageSkeleton />}> renders skeleton
            └─ data arrives → component mounts, skeleton disappears
```

#### Tier 2 — Mutations and in-page async actions: `useTransition` + overlay

All mutations are wrapped in React 19 async `startTransition`. The `isPending` boolean drives a Mantine `<LoadingOverlay>` that shields the current content while the request is in flight. The underlying form and page content remain rendered and visible beneath the overlay — they are never unmounted, never disabled, and input values are preserved so the player can immediately retry if the request fails.

```tsx
const [isPending, startTransition] = useTransition()

const handleDraw = () => {
    startTransition(async () => {
        const result = await apiClient.post(`/api/sessions/${sessionId}/draw`)
        if (result.ok) queryClient.invalidateQueries({ queryKey: ["session", sessionId] })
        else setError(result.error.message)
    })
}

// In JSX:
<Box pos="relative">
    <LoadingOverlay visible={isPending} />
    <IonButton onClick={handleDraw}>Draw</IonButton>
    {error && <ErrorMessage>{error}</ErrorMessage>}
</Box>
```

#### Suspense boundary placement

Suspense boundaries must be placed **inside** all Context providers — never above them. A Suspense boundary above a Context will unmount the Context and reset its state when its children suspend.

Correct placement in the Chance provider tree:

```
AuthProvider
  SessionProvider
    CardProvider
      TransferProvider
        AppHeaderProvider
          AppErrorBoundary
            IonReactRouter
              ← Suspense boundaries live here, at the route level
```

Each route component is individually wrapped in its own Suspense boundary with a skeleton tailored to that page's layout. There is no single top-level Suspense that would blot out the whole app.

#### React Query configuration for Suspense

- All queries use `useSuspenseQuery` (suspends on first load, never on background refetch)
- Session polls use `refetchInterval` directly on the query — no re-suspension occurs during polling
- On cache hit from a prior session, the data renders synchronously with no suspension at all

---

## 6. API Design Contract

This section consolidates the API design conventions that span both backend and mobile.

### 6.1 Principles

1. **Consistent envelope.** All responses use the `{ ok, data/error, serverTimestamp }` envelope for predictable parsing.
2. **Mutations return the full entity.** Success responses always return the full updated entity so the client can update its React Query cache in one step without a follow-up GET.
3. **Errors surface to the user.** Failed requests are shown inline near the triggering action; no silent retry or background queue.

### 6.2 Endpoint Design Patterns

#### Mutations return the full updated entity

```
POST /api/cards
→ { ok: true, data: Card, serverTimestamp }

PATCH /api/transfers/:id
→ { ok: true, data: CardTransfer, serverTimestamp }
```

#### Session state polling returns a diff-friendly payload

```
GET /api/sessions/:id/state?since=<ISO timestamp>
→ {
    ok: true,
    data: {
      players: Player[],
      drawEvents: DrawEvent[],        // only events since `since`
      pendingTransfers: CardTransfer[],
      serverTimestamp: string
    }
  }
```

The `since` parameter reduces payload size on every poll after the first.

### 6.3 Error Handling

| Scenario               | Action                                                                |
| ---------------------- | --------------------------------------------------------------------- |
| Network loss           | Show inline error; `NetworkStatusBanner` if device is offline         |
| `401` Unauthorized     | Refresh tokens and replay once; redirect to login if refresh fails    |
| `409` Conflict         | Show error; React Query invalidation fetches latest server state      |
| `422` Validation Error | Surface field-level validation message from `error.details`           |
| All other 4xx / 5xx    | Show inline error message from `error.message`                        |

---

## 7. Cross-Cutting Patterns

### 7.1 Validation

Zod schemas defined once in `core` and used at all three layers:

- API input validation in backend route handlers
- Form validation via `@hookform/resolvers` in mobile
- TypeScript type inference across both apps — no type duplication

### 7.2 Error Handling

- **Backend:** `AppError` subclasses map to HTTP status codes; route handlers catch and serialize into the response envelope
- **Mobile:** `AppErrorBoundary` catches render errors; `NetworkStatusBanner` surfaces connectivity state; `ApiError` carries structured metadata for inline error messaging

### 7.3 Security

- No raw SQL string interpolation — all queries use prepared statements with bound parameters
- Passwords hashed with `bcryptjs`
- Tokens stored in encrypted native storage (not `localStorage` or `sessionStorage`)
- CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, and `Referrer-Policy` enforced at middleware level
- Rate limiting on auth, guest-register, and invitation-validate endpoints
- `withAdmin` HOF enforces `is_admin` check independently of `withAuth`

### 7.4 Content Moderation

The concentric circles pool model limits exposure: strangers' cards never enter a session unless a player with `card_sharing = 'network'` vouches for them via game-lineage. The global pool is admin-curated, not crowd-sourced.

- **Community layer:** upvotes and downvotes adjust draw weights in real time; flags are a lightweight report signal (no automatic hold)
- **Admin layer:** admins review reported cards and deactivate as needed (`card.active = false`); admins also manage the global pool directly (promote/demote `card.is_global`) from the My Cards → All cards tab in the mobile app
- Card deactivation is the single moderation primitive — it excludes the card from all future draw pools while preserving draw history

### 7.5 TypeScript Configuration

- Root `tsconfig.json` defines base settings; each app extends it
- `packages/core` output types referenced via workspace paths
- All packages use `strict: true`

---

## 8. Environment & Configuration

| File                    | Scope          | Purpose                                                        |
| ----------------------- | -------------- | -------------------------------------------------------------- |
| `turbo.json`            | Root           | Task pipeline and cache configuration                          |
| `pnpm-workspace.yaml`   | Root           | Workspace roots                                                |
| `tsconfig.json`         | Root / per-app | TypeScript compiler options (strict mode)                      |
| `.prettierrc`           | Root           | Code formatting rules                                          |
| `next.config.mjs`       | Backend        | Next.js config, `core` package transpilation                   |
| `vite.config.ts`        | Mobile         | Vite plugins, dev server (port 8100, `0.0.0.0`), ES2022 target |
| `capacitor.config.ts`   | Mobile         | App ID, web dir, dev server URL                                |
| `.env` / `.env.example` | Per-app        | API URLs, JWT secrets, feature flags                           |
| `src/middleware.ts`     | Backend        | Global CORS + security headers                                 |
| `db/seed.ts`            | Backend        | Database initialization and canonical card seeding             |

---

## 9. MVP Scope & Future Considerations

### 9.1 MVP (v1.0)

- Invite-code registration flow + admin code management
- Guest join flow (display name only)
- Session create (registered only) / join (code + QR)
- Session filter setup (drinking, age, game tag)
- Card draw with weighted algorithm
- Card submission during session (with game tag array)
- Card reveal flow (private → delayed all-players)
- Upvote / downvote / flag
- Card transfer between players (either-initiates, other-accepts)
- In-session account claiming (guest → registered mid-session)
- Inline error handling; `NetworkStatusBanner` for offline state
- Admin portal: invitation code management, user management, basic analytics
- Global card pool management (promote/demote/deactivate) in mobile app, admin-scoped users only
- Android + iOS builds via Capacitor

### 9.2 Post-MVP Considerations

- Push notifications for card transfers and turn reminders (Capacitor Push Notifications + FCM/APNs)
- LLM-generated card suggestions based on current game context
- Custom session decks: host curates a specific card subset before the game
- Session history and personal card stats for registered users
- Real-time sync upgrade (WebSocket / SSE) if polling latency proves insufficient
- Card categories / theme browsing UI
- Localization (i18n) for non-English card content
- Social graph: friends list, invite friends directly to sessions

---

_Chance — Technical Overview & Design Document · v0.1 Draft_
