# Chance — UX & Product Design Decisions
### LLM Handoff Document · v0.1

This document captures all UX, product, and data model decisions made during design sessions. It is intended as a complete handoff for an LLM or developer taking over implementation. Read this alongside `CHANCE_TECHNICAL_OVERVIEW.md`.

---

## 1. What is Chance?

Chance is a social party app that acts as a live companion layer on top of physical board games. When an in-game event triggers a "Chance" moment, the active player draws a card from a shared, ever-growing pool. Cards carry effects like dares, drinking mechanics, and conversation prompts. The app is designed to be low-friction — guests can join and play immediately without accounts.

---

## 2. Terminology

| Term | Definition |
|---|---|
| **Game Session** | A single instance of play. Created by a host, joined by players, expires after 16 days or when the host leaves. Previously called "session." |
| **Game Settings** | The host-only configuration screen for a Game Session (filters, name). Previously called "lobby." Never shown to non-hosts. |
| **Player** | An ephemeral game identity scoped to a single Game Session. Keyed on normalized name (lowercase, trimmed). Optionally linked to a User. |
| **User** | A permanent registered account with email, password, and history. Optional — guests play without one. |
| **CardVersion** | An immutable snapshot of a card at a point in time. Cards are versioned; edits create new versions, never overwrite. |

---

## 3. Access model

| Actor | Registration | Create game session | Join game session | Submit card | Edit own cards |
|---|---|---|---|---|---|
| Guest | Display name only | No | Yes | No | No |
| Registered User | Invite code required | Yes | Yes | Yes (in game session OR outside) | Yes |
| Admin | Registered + admin flag | Yes | Yes | Yes | Yes (+ any card) |

**Invite code:** A single gate used only at registration. Not stored on the User record. Admin can update the current valid code(s) at any time via the admin portal. No per-code usage tracking — it is purely a registration gate.

---

## 4. Identity model

### User (permanent)
- Email, password (bcryptjs), display name, `is_admin` flag
- Persists indefinitely
- Can be linked to zero or more Players across game sessions

### Player (ephemeral)
- Scoped to one Game Session
- Primary key within a game session: **normalized name** (lowercase, trimmed)
- Optional `userId` FK — links the Player to a User account
- `active: boolean` — set to false when host marks player inactive ("kicks"); player can rejoin and be reactivated by re-entering with the same name
- No concept of "kicked" — inactivation is a housekeeping convenience, not a punishment

### Player ↔ User linking rules
- Set on join if a remembered User exists on the device and they choose "play as [User]"
- Set if a User logs in mid-game via the side menu while that Player is active
- Can be unlinked via an advanced option (sets `player.userId = null`)
- Never transferred — cannot relink a Player to a different User
- The host role is a property of the Player record (`session.hostPlayerId`), not the User — if the host Player leaves, the game ends regardless of which User is logged in

### Shared device model
- Multiple Players can be registered to one device within a Game Session
- One active Player at a time — switch via the persistent player switcher (no auth friction)
- A logged-in User is the "device owner" but is not necessarily one of the playing Players
- All Players on the device share one view; history is attributed per Player

---

## 5. Authentication model (Option D)

- No login wall on the home screen
- A remembered User account is stored silently on the device (Capacitor Secure Storage)
- A small unobtrusive account indicator in the corner if a User is remembered
- Log out available from the side menu at any time
- **Creating a game session:** requires a User — if no remembered account, inline login/register prompt
- **Joining a game session (with remembered User):** prompt — "Join as [display name] or join as someone else?" — one tap to link as registered player (card-sharing selector shown, default: Network), or enter a different name as guest
- **Joining a game session (no remembered User):** straight to name entry (joins as guest; no card-sharing setting)
- **Mid-session:** User can log in from the side menu; this links the current active Player to that User and presents the card-sharing selector (default: Network)

---

## 6. Game Session lifecycle

### Creation
1. Registered User taps "Create game session" on Home
2. Game Settings screen opens — **no Game Session record exists yet**
3. Host configures: session name, drinking toggle, age-appropriate toggle, game tag(s), card-sharing level (None / My cards / My network — default: My network)
4. Host taps Save → **Game Session record is created** → join code and QR generated
5. Host lands on the Game screen immediately — the game is live
6. Join code and QR are shared from **within the Game screen** — never from Game Settings
7. If host cancels before saving → no record created → returns to Home

### Joining
1. Any user enters join code or scans QR
2. Enters display name
3. Fuzzy name match (case-insensitive, trimmed) against existing Players in that Game Session
   - Match found → silently resumes as that Player (reactivates if inactive)
   - No match → joins as a new Player
4. Lands **directly on the Game screen** — no waiting state, no lobby
5. Full card history is visible immediately (late joiners see everything)

### Mid-game
- Host can return to Game Settings via side menu to update filters
- Filter changes apply to **future draws only** — no retroactive effect
- Other players receive a **toast notification** when filters are updated (informational only)
- Any Player can draw at any time — no turn tracking in the app
- Only registered Players can submit new cards; guests draw from the existing pool
- Multiple concurrent draws are allowed — ordered by timestamp in history

### Ending
- **Host leaves → game ends for everyone** — leaving IS ending if you are the host
- Non-host leaves → they exit, game continues for everyone else
- Game Session also expires automatically after **16 days**
- On game end: all players are navigated to Game Session History (read-only) before exiting
- Registered Users can access past game sessions from the side menu at any time

---

## 7. Card model

### Card fields
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Permanent card identifier |
| `authorUserId` | FK → User | The registered User who submitted the card — **never null** (only registered users submit) |
| `active` | boolean | False = deactivated by owner or admin; excluded from all draw pools everywhere |
| `isGlobal` | boolean | True = admin-promoted to the global pool; eligible for all sessions regardless of who is playing |
| `createdInSessionId` | FK → Session (nullable) | The session in which this card was originally submitted; null = created outside a session |
| `currentVersionId` | FK → CardVersion | Points to the latest version |
| `createdAt` | timestamp | |

### CardVersion fields (immutable once created)
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `cardId` | FK → Card | |
| `versionNumber` | integer | Increments on each save |
| `title` | string | Always visible to all players |
| `description` | text | Visible per `hiddenDescription` logic |
| `hiddenDescription` | boolean | If true, only the drawing Player sees it initially |
| `imageUrl` | string | Uploaded image |
| `isDrinking` | boolean | Excluded when session drinking filter is off |
| `isFamilySafe` | boolean | Excluded when session age-appropriate filter is off |
| `gameTags` | string[] | One or more game names, or empty = universal |
| `authoredByUserId` | FK → User | May differ from card author if admin edited |
| `createdAt` | timestamp | |

### Versioning rules
- Edits always create a new `CardVersion` — previous versions are immutable
- Draw events reference the specific `CardVersion` that was current at draw time — permanent
- Game session history always shows the version-locked card
- Deactivating a card (`card.active = false`) removes it from future draw pools but never affects history
- Admin edits create a new `CardVersion` attributed to the admin User — original authorship is preserved on earlier versions

### Game tags
- A card with zero game tags is **universal** — eligible for any game session regardless of filter
- A card with one or more game tags is only eligible for sessions filtered to one of those games, or sessions with no game filter set
- Enforced server-side at draw time and validated at submission

### Card draw algorithm (weighted random)

The pool for a session is assembled from four tiers. A card must have `active = true` and pass session filters (drinking, age, game tag) to be eligible in any tier.

| Tier | Eligible when | Base weight |
|---|---|---|
| **This-session** | `createdInSessionId` = current session | `3.0×` |
| **Game-lineage** | `createdInSessionId` is set AND at least one player in the session has `cardSharing = 'network'` and participated in that origin session | `1.0` |
| **Player library** | `authorUserId` links to a registered player in this session with `cardSharing = 'mine'` or `'network'` | `1.0` |
| **Global** | `isGlobal = true` | `1.0` |

Cards may qualify under multiple tiers; the highest base weight applies. Weight modifiers applied on top:
- Upvote bonus: `+0.2` per net upvote, capped at `+2.0`
- Downvote penalty: net negative votes → `0.5×`
- Recently drawn suppression: cards drawn in the last N draws → `0.1×`

**`cardSharing` levels** (set per player per session, default: Network):
- **None** — player contributes nothing to the pool
- **My cards** — player's own library cards enter the pool (Tier 3)
- **My network** — player's library cards + game-lineage cards from their recent sessions (Tiers 3 + 4)

---

## 8. Card reveal flow

1. Any Player taps their Draw button
2. Server runs weighted draw algorithm, creates a `DrawEvent` referencing the current `CardVersion`
3. Full-screen card reveal overlay animates in — **only on the drawing Player's device**
4. Card shows: image + title always visible
5. If `hiddenDescription = true`: description is hidden behind a "Show description" tap
   - Only the drawing Player (active Player whose name matches the drawer) can see it
   - Drawing Player can toggle "Share description" to make it visible to all Players
6. Drawing Player taps to dismiss → overlay closes → card enters history
7. After `REVEAL_DELAY` (default 3000ms): card appears in all other Players' history views
8. If drawing Player shared description: it is visible to all in history; otherwise hidden for all others

---

## 9. Card transfer flow

1. Either Player involved taps "Transfer card" from within the Notifications modal or card history
2. A player picker lists current game session Players (excluding self / active Player)
3. Transfer request created optimistically locally
4. Recipient sees the request appear in their **Notifications** (side menu badge increments)
5. Recipient opens Notifications modal → acts inline: Accept or Reject
6. On accept: draw event is logically reassigned to recipient Player for display in history
7. Transfer is synced to server; `isNetworkError` detection handles offline queueing

---

## 10. Card resolution flow

1. Any Player can request resolution of a card via the card detail view in history
2. Request appears in the **host Player's Notifications**
3. If the active Player on this device is the host: they can resolve directly from Notifications
4. Host accepts resolution → card is visually marked as resolved in history for all Players
5. Resolution is rare — most cards persist and stack for the whole game
6. Resolved cards appear with a distinct visual treatment in history (e.g. muted, strikethrough, badge)

---

## 11. Navigation topology

### Side menu

| Item | Condition |
|---|---|
| Log in / Register | Not logged in |
| Account (display name + log out) | Logged in |
| Notifications + badge count | Logged in OR in active game session as any player |
| Past game sessions | Logged in |
| My cards | Logged in |
| Submit card | Logged in (registered player in active game session, or outside game session) |
| Return to game settings | In an active game session AND active player is host |
| Leave game session | In an active game session |
| End game session | In an active game session AND active player is host |

### Page hierarchy

```
Home
├── [modal] Log in
│   └── → Home (on success)
├── [modal] Register
│   └── → Home (on success)
├── [modal] Join game session
│   ├── Enter code / scan QR
│   ├── Enter display name
│   │   └── [if logged in] "Play as [User] or different name?"
│   └── → Game (immediately — no waiting state)
├── → Game settings (registered only — no Game Session record exists yet)
│   └── Host configures filters, name → saves
│       └── Game Session record created + join code generated
│           └── → Game
└── → Past game sessions (registered only)
    └── → Game session history (read-only)
        └── [modal] Card detail (read-only, no actions)

Game settings  ← host only, never shown to non-hosts
├── Accessible two ways:
│   ├── New: "Create game session" on Home (no record yet)
│   └── Edit: side menu mid-game (record exists, changes apply to future draws only)
├── Fields: session name · drinking toggle · age-appropriate toggle · game tag(s) · card-sharing level (host's own setting)
├── Save (new) → creates Game Session record → join code generated → → Game
├── Save (edit) → updates filter settings → [toast to all players] → → Game
└── Cancel (new, unsaved) → → Home — no record created

Game
├── Join code / QR share (accessible here, not before)
├── Player switcher (persistent — see below)
├── [overlay] Full-screen card reveal
│   ├── Tap to show description (hidden=true AND active player is drawer)
│   ├── [if active player is drawer] "Share description" toggle
│   └── Tap to dismiss → back to Game
├── [modal] Add player to device
│   └── Enter name → fuzzy match → silently resumes or joins fresh
├── [modal] Submit card (from side menu — registered players only)
│   └── Image · title · description · hidden flag · game tags · drinking · family-safe
│   └── Card auto-saved to submitter's library after session
└── → Game session history (on host leaving/ending, or non-host leaving)

Notifications (side menu)
└── [modal] Notifications list
    ├── Card transfer requests (pending) — accept / reject inline
    └── Card resolution requests (pending, host only) — resolve / dismiss inline

Game session history (read-only)
├── Full card history — each card locked to the CardVersion drawn at the time
├── Resolved cards visually distinct
├── [modal] Card detail (version-locked)
│   ├── Vote (up/down) — any player
│   ├── Flag — any player
│   └── Request transfer — any player
│   └── Request resolution — any player (sends to host Notifications)
└── → Home (exit)

My cards (registered users only, side menu)
├── "My cards" tab — cards submitted by this User
│   ├── Current version shown per card
│   ├── Version count badge ("v3") if previously edited
│   └── Status badge: active · flagged · removed
├── "All cards" tab — admins only
│   ├── Full card pool, searchable and filterable
│   ├── Edit any card → new CardVersion attributed to admin
│   ├── Deactivate entire card (card.active = false) — history unaffected
│   └── Promote card to global pool (card.isGlobal = true) / Demote from global pool
├── [modal] Card detail — editable view (own cards, or any card if admin)
│   ├── Full edit form pre-populated with current version
│   │   └── Image · title · description · hidden flag · game tags · drinking · family-safe
│   ├── Save → creates new CardVersion (previous versions immutable)
│   ├── Deactivate card → card.active = false (owner or admin)
│   └── Version history — read-only list of past versions with timestamps
└── [modal] Submit new card
    └── Available to registered users outside a game session
```

### Player switcher (persistent, in-game only)

```
Player switcher (tap)
├── List of players on this device
├── → Switch active player (no friction)
├── → Add player to device [modal]
│   └── Enter name → fuzzy match → silently resumes or joins fresh
└── [advanced] Unlink player from User account
```

---

## 12. Admin portal (web only — not mobile)

The admin portal is a separate Next.js web UI (`/admin`). It is intentionally minimal — card management (including global pool curation) lives in the mobile app under My Cards → All cards, accessible only to admin-scoped Users.

```
Admin portal
├── Invite code management
│   └── Create / update current valid code(s) / view recent usage
└── User management
    ├── Search users
    ├── Reset password
    ├── Update display name / email
    ├── Promote to admin
    └── Deactivate account
```

---

## 13. Toast and notification rules

| Event | Treatment | Who sees it |
|---|---|---|
| Host updates game filters | Toast | All non-host players in game session |
| Player joins game session | Toast | All players currently in game session |
| Player leaves game session | Toast | All players currently in game session |
| Card transfer request received | Notifications badge + modal | Recipient player |
| Card resolution request received | Notifications badge + modal | Host player |
| Game session ended by host | Full-screen → Game session history | All non-host players |
| Game session expired | Toast on next open | Any player who re-enters |

---

## 14. Offline-first & sync rules

All mutations are written locally first and synced to the server opportunistically. Key rules:

- Every local entity record carries `syncStatus: "pending" | "synced" | "failed"`
- All mutating API endpoints accept an `Idempotency-Key` header — safe to retry
- `ApiClient` distinguishes network loss (probe `GET /api/health`) from server errors
- Network loss → mutation enqueued in `MutationQueue` (Capacitor Preferences, max 3 retries, exponential backoff)
- Permanent server failure (`4xx` non-retryable) → `syncStatus: "failed"` → surfaced in Notifications or inline
- A `PendingSyncIndicator` in the side menu shows count of unsynced mutations
- Card draws, votes, transfers, and resolution requests all follow this pattern
- Card submissions made inside a game session are added to the local draw pool immediately — before server confirmation

---

## 15. Key constraints summary

| Rule | Detail |
|---|---|
| Game Session record not created until host saves Game Settings | Nothing is joinable before that moment |
| Join code and QR only accessible from the Game screen | Never from Game Settings |
| Game Settings is host-only | Non-hosts never see it |
| Non-hosts go directly to Game on join | No waiting state |
| Host leaving = game ends | Leaving IS ending for the host |
| CardVersions are append-only | Saves never overwrite; draw history is version-locked |
| Card deactivation is non-destructive | History always shows the version that was drawn |
| Only registered users can submit cards | Guests draw from the pool but cannot contribute cards |
| `createdInSessionId` tracks a card's origin session | Enables game-lineage pool tier; cards submitted outside sessions have null |
| `isGlobal` is admin-only | Users cannot self-promote cards to the global pool |
| `cardSharing` defaults to Network | Registered players opt down if needed; guests have no sharing setting |
| In-session submissions auto-save to the submitter's library | `active = true`, `isGlobal = false`, `createdInSessionId` set to that session |
| Player normalized name is the session key | Not device, not account |
| Hidden description visible only to drawer | Only drawer can share it; no one else can reveal it |
| Voting and flagging in history only | Not on the full-screen card reveal |
| Fuzzy name match on rejoin | Case-insensitive, trimmed — no auth required |
| One logged-in User per device at a time | But multiple Players can be active on one device |
| Admin card management lives in the app | "All cards" tab in My cards, admin-scoped Users only |
| Admin portal is user management + invite codes only | No card management in the portal |
