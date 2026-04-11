You are implementing a full-stack feature for Chance. Use this guide to understand the implementation architecture and domain model for the feature you are about to build.

---

# Chance — Full-Stack Implementation Guide

## Layer-by-Layer Implementation Order

When adding a new endpoint, feature, or any change that touches multiple layers, follow this order:

### 1. Schema (`packages/core/src/schemas/`)

Define or update the Zod schema. This is the **single source of truth** for both backend validation and frontend TypeScript types. Never duplicate types in apps.

- New entity schema → new file in `src/schemas/`, export from `src/schemas/index.ts`
- Text field limits → add constants to `packages/core/src/constants/textLimits.ts`, import into the schema
- API request/response types → `packages/core/src/schemas/api.ts`
- All types inferred via `z.infer<typeof Schema>` — no manual `interface` duplication
- Frontend forms use the same schema via `zodResolver`; extend with `.extend()` to add user-facing error messages without duplicating the shape

### 2. Backend Repo (`apps/backend/src/lib/repos/<entity>Repo.ts`)

Add a prepared-statement method. Rules:

- All queries use `better-sqlite3` prepared statements — **no string interpolation**
- Boolean columns use `boolToInt`/`intToBool` bridge helpers (SQLite has no native bool)
- Return raw DB row types; the service layer maps to domain types

### 3. Backend Service (`apps/backend/src/lib/services/<entity>Service.ts`)

Business logic and orchestration. Rules:

- Throws `AppError` subclasses from `packages/core/src/errors/` — never returns raw DB rows
- Validates business rules, enforces access constraints
- Composes repo calls; never accesses DB directly

### 4. Backend Route (`apps/backend/src/app/api/<path>/route.ts`)

The HTTP handler. Rules:

- Parse and validate input with the Zod schema from `packages/core`
- Wrap with `withAuth` (any JWT) or `withAdmin` (admin scope); add registered-user check only where needed
- Every response uses the `{ ok: true, data, serverTimestamp }` / `{ ok: false, error, serverTimestamp }` envelope — no exceptions
- All `POST`/`PATCH`/`DELETE` endpoints support `Idempotency-Key` header (24h TTL via `idempotency_cache`); return cached response with `X-Idempotent-Replay: true` on duplicate
- Mutations return the **full updated entity** so the client can reconcile in one step

### 5. Mobile API Types (`apps/mobile/src/lib/api/types.ts`)

Re-export new schemas or types needed on the client:

```ts
export type { NewEntityType } from "@chance/core";
export { NewEntitySchema } from "@chance/core";
```

Propagate to `apps/mobile/src/lib/api/index.ts` if used in components.

### 6. Mobile API Client (`apps/mobile/src/lib/api/real.ts` + `mock.ts`)

Add a typed method to `ApiClient`. Rules:

- Returns `ApiResult<T>` (discriminated union `{ ok: true, data } | { ok: false, error }`) — **never throws**
- 15s timeout via `AbortController`; auto-refreshes tokens on `401`/`X-Token-Status: invalid` and replays once
- Add a matching stub to `mock.ts` for dev/test

### 7. Mobile Component / Page

Consume via `apiClient.<method>()`. Rules:

- **Mutations:** wrap in React 19 async `startTransition`; use `isPending` for a `<LoadingOverlay>` — form stays rendered underneath
- **Queries:** `useSuspenseQuery` everywhere; Suspense boundaries at route level only
- Show errors inline near the triggering action — no toast for expected outcomes
- Never disable inputs while a mutation is in-flight; preserve state for retry
- **Forms:** use `react-hook-form` (`useForm`) + `zodResolver` for every form. Use the shared `@chance/core` Zod schema as the resolver (extending via `.extend()` for user-facing messages). Never use manual `useState` per field or ad-hoc validation. Render per-field errors inline; API errors go to `setError("root", ...)`. For `IonInput`, bridge `onIonInput` → `register("field").onChange(...)` since Ionic does not fire native `onChange`.

---

## Domain Model

### Access Model

| Actor      | Register                | Create Session | Join Session | Submit Card | Edit Own Cards |
| ---------- | ----------------------- | -------------- | ------------ | ----------- | -------------- |
| Guest      | Name only               | No             | Yes          | No          | No             |
| Registered | Invite code required    | Yes            | Yes          | Yes         | Yes            |
| Admin      | Registered + admin flag | Yes            | Yes          | Yes         | Yes + any card |

### Identity Model

**User (permanent):** email, password (bcryptjs), display name, `is_admin`. Persists indefinitely.

**Player (ephemeral):** scoped to one session. Primary key within a session: **normalized name** (lowercase, trimmed). Optional `userId` FK links to a User.

- `active: boolean` — false when host marks player inactive; player can rejoin by re-entering same name
- `player_token` (UUID, **guest players only**) — device-binding token; stored in guest JWT + Capacitor Preferences; validated server-side on every guest request; null for registered players; cleared by host via "Reset identity"

**Shared device model:** multiple Players can be registered to one device. One registered User (`auth.user`) max — secondary players added via the switcher are guests only. If `auth.user !== null`, in-session claim flow is hidden throughout the app.

### Auth Model (Option D)

- No login wall on home screen
- Remembered User stored silently on device (Capacitor Secure Storage / `sessionStorage` on web)
- Guest JWTs are **ephemeral** — not persisted; cleared when session ends or app restarts
- Creating a session requires a User; joining does not
- Mid-session: User can log in from side menu → triggers `POST /api/auth/claim` → atomically links guest player record to real account; all prior guest activity preserved

### Game Session Lifecycle

**Creation:**

1. Registered User taps "Create game session"
2. Game Settings screen opens — **no Session record exists yet**
3. Host configures name + filters → taps Save → Session record created + join code generated → lands on Game screen

**Joining:**

1. User enters join code or scans QR → enters display name
2. Fuzzy match (case-insensitive, trimmed) against existing Players:
    - No match → new Player; server generates `player_token`; client stores in Preferences
    - Guest match + matching token on device → silent resume (reactivates if inactive)
    - Guest match + no token → error: _"This name is already taken."_
    - Registered match → requires account login
3. Lands directly on Game screen — no waiting state

**Ending:**

- **Host leaves = game ends for everyone** — host cannot transfer the host role
- Non-host leaves → they exit, game continues
- Auto-expires after 16 days

### Card Model

**Card entity (permanent identity):**

| Field                | Notes                                                                |
| -------------------- | -------------------------------------------------------------------- |
| `id`                 | uuid                                                                 |
| `authorUserId`       | FK → User — original creator, set at creation, never changes         |
| `ownerUserId`        | FK → User — current owner, starts = authorUserId, mutable via transfer |
| `cardType`           | `chanceCard` or `reparationsCard` — Card-level, admin-only to change |
| `active`             | false = excluded from all draw pools; history unaffected             |
| `isGlobal`           | admin-promoted to global pool                                        |
| `createdInSessionId` | session where card was originally submitted; null = outside session  |
| `currentVersionId`   | FK → latest CardVersion                                              |

**CardVersion (immutable once created):**

| Field                  | Notes                                                    |
| ---------------------- | -------------------------------------------------------- |
| `title`, `description` | core content                                             |
| `hiddenDescription`    | if true, only drawer sees it initially; drawer can share |
| `imageId`              | ID of image in the images table                          |
| `drinkingLevel`        | 0–3 int                                                  |
| `spiceLevel`           | 0–3 int                                                  |
| `isGameChanger`        | triggers dramatic reveal (3500ms intro + special audio)  |
| `gameTags`             | string[]; empty = universal card                         |
| `authoredByUserId`     | may differ from card author if admin edited              |

**Versioning rules:**

- Edits always create a new CardVersion — previous versions are immutable
- `draw_events.card_version_id` references the version current at draw time — permanent
- Deactivating a card never affects history

### Card Draw Algorithm (four tiers, weighted random)

| Tier           | Eligible when                                                                       | Base weight |
| -------------- | ----------------------------------------------------------------------------------- | ----------- |
| This-session   | `createdInSessionId = currentSession`                                               | `3.0×`      |
| Game-lineage   | created in a session where a current player has `card_sharing = 'network'`          | `1.0`       |
| Player library | author is a registered player in this session with `card_sharing ∈ {mine, network}` | `1.0`       |
| Global         | `isGlobal = true`                                                                   | `1.0`       |

Weight modifiers: upvote bonus `+0.2` per net upvote (cap `+2.0`); downvote penalty `0.5×`; recently-drawn suppression `0.1×`.

### Card Reveal Flow

1. Player taps Draw → server creates `DrawEvent` referencing current `CardVersion`
2. If `isGameChanger = true`: 3500ms dramatic intro plays on drawer's device only
3. Full-screen reveal overlay on drawer's device only
4. `hiddenDescription = true` → description hidden behind "Show description" tap (drawer only)
5. Drawer can toggle "Share description" to make it visible to all
6. After `REVEAL_DELAY` (3000ms): card appears in all other players' history views

### Card Transfer Flow

1. Either player initiates from Notifications modal or card history
2. `POST /api/transfers` with `draw_event_id` and `to_player_id`
3. Recipient sees request in Notifications (badge increments)
4. Recipient accepts or rejects inline in Notifications modal
5. On accept: draw event logically reassigned to recipient for history display

### Card Resolution

1. Any player taps "Resolve" on any card
2. `DrawEvent.resolved = true` immediately
3. Reversible — tapping again un-resolves (`resolved: false`)
4. No notifications; no host approval

---

## Navigation Topology

### Side Menu Conditions

| Item                    | Shown when                                  |
| ----------------------- | ------------------------------------------- |
| Log in / Register       | Not logged in                               |
| Account + Log out       | Logged in                                   |
| Notifications + badge   | Logged in OR in active session              |
| Past game sessions      | Logged in                                   |
| My cards                | Logged in                                   |
| Submit card             | Logged in                                   |
| Return to game settings | In active session AND active player is host |
| Leave game session      | In active session                           |
| End game session        | In active session AND active player is host |

### Key Routes

| Route                 | Access                         | Notes                                       |
| --------------------- | ------------------------------ | ------------------------------------------- |
| `/`                   | Open                           | Home                                        |
| `/login`, `/register` | Open                           | Detect guest JWT → route through claim flow |
| `/join/:code`         | Open                           | Direct join link                            |
| `/game-settings`      | Registered (new) / Host (edit) | No Session record until Save                |
| `/game/:sessionId`    | Session member                 | Active game                                 |
| `/card/:drawEventId`  | Session member                 | Full-screen card detail                     |
| `/submit-card`        | Session member                 | Submit new card                             |
| `/my-cards`           | Registered only                | Card management                             |
| `/history/:sessionId` | Registered only                | Past session review (read-only)             |

---

## Toast & Notification Rules

| Event                     | Treatment                   | Audience             |
| ------------------------- | --------------------------- | -------------------- |
| Host updates game filters | Toast                       | All non-host players |
| Player joins              | Toast                       | All current players  |
| Player leaves             | Toast                       | All current players  |
| Card transfer received    | Notifications badge + modal | Recipient            |
| Game ended by host        | Full-screen → history       | All non-host players |

---

## Key Constraints (Never Violate)

| Rule                                                     | Detail                                                |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Session record not created until host saves              | Nothing is joinable before that moment                |
| Join code only accessible from Game screen               | Never from Game Settings                              |
| Game Settings is host-only                               | Non-hosts never see it                                |
| Host leaving = game ends                                 | The host cannot transfer the host role                |
| CardVersions are append-only                             | Saves never overwrite; draw history is version-locked |
| Card deactivation is non-destructive                     | History always shows the version that was drawn       |
| Only registered users can submit cards                   | Guests draw only                                      |
| `isGlobal` is admin-only                                 | Users cannot self-promote cards                       |
| `cardSharing` defaults to network                        | Registered players opt down if needed                 |
| `cardType` is Card-level, not Version-level              | Admin-only to change post-creation                    |
| One registered User per device                           | Secondary player slots are guest-only                 |
| In-session claiming only when no registered User exists  | A primary guest may claim; secondary players cannot   |
| Guest player identity is device-bound via `player_token` | Active on exactly one device at a time                |
| Hidden description visible only to drawer                | Only drawer can choose to share it                    |
| Voting and flagging in history only                      | Not on the full-screen card reveal                    |
| Schemas in `packages/core` are the source of truth       | Never duplicate types in apps                         |
