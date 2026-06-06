# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Chance?

Chance is a social party app played on a single shared phone alongside physical board games. When a game event triggers a "Chance" moment, the active player draws a card from a shared pool. Cards carry dares, drinking mechanics, and prompts. The card pool grows as registered players submit cards across sessions. Guests need no account — they join by entering a display name.

## Terminology

| Term | Definition |
|------|------------|
| **Game Session** | A single instance of play. Created by a registered host. |
| **Player** | An ephemeral game identity scoped to one session. Optionally linked to a User. |
| **User** | A permanent registered account (email + password, invite-code-gated). |
| **CardVersion** | Immutable snapshot of card content. Edits create new versions; draw history references the version drawn. |
| **cardType** | `chanceCard` or `reparationsCard` — set at creation, Card-level (not version-level), admin-only to change post-creation. |
| **card_sharing** | Per-player, per-session setting: `none` / `mine` (default). Controls how a registered player contributes cards to the draw pool. |
| **authorUserId** | Immutable original creator of a card — never changes. |
| **ownerUserId** | Current owner — changes on card transfer. Used for `GET /api/cards/mine` and editing rights. |

## Project Status

This app is **released and in production**. The database is live on real devices. Any schema change requires a migration — never modify `init.ts` alone.

## Monorepo Structure

pnpm workspaces + Turborepo. Package manager pinned to `pnpm@10.33.0`.

```
root/
├── apps/
│   ├── backend/        # Next.js (App Router) — API + admin portal; runs on port 3001
│   └── mobile/         # Ionic 8 / Capacitor 8 / React 19 / Vite 6 — targets web + native equally
├── packages/
│   └── core/           # Shared Zod schemas, AppError types, constants
├── turbo.json
└── pnpm-workspace.yaml
```

Turbo pipeline: `core` builds first, then apps. `build` → `test`, `lint`, `typecheck` all depend on `^build`.

## Common Commands

```bash
pnpm install
pnpm dev                            # all apps
pnpm build                          # all apps
pnpm lint && pnpm typecheck

pnpm --filter backend dev
pnpm --filter backend db:migrate    # runs src/db/migrate.ts (canonical)
pnpm --filter backend db:seed

pnpm --filter mobile dev            # Vite dev on port 8100
pnpm --filter mobile test.unit      # Vitest
pnpm --filter mobile test.e2e       # Cypress

npx cap sync && npx cap run android
npx cap sync && npx cap run ios
```

## Code Style

Root `.prettierrc`: double quotes, semicolons, trailing commas (ES5), 4-space indent, 100-char print width. TypeScript strict mode across all packages.

## Shared Core Package (`packages/core`)

- **Schemas** (`src/schemas/`): Zod schemas for all domain entities — `Card`, `CardVersion`, `Session`, `Player`, `CardTransfer`, `DrawEvent`, `FilterSettings`, `Game`, `RequirementElement`, `CardAnalysisResult`, `User`, etc. Use for runtime validation and `z.infer<>` types. Never duplicate types in the apps.
- **Errors** (`src/errors/`): `AppError` base + `AuthenticationError`, `AuthorizationError`, `ValidationError`, `NotFoundError`, `ConflictError`, `InvitationCodeError`, `InternalError`.
- **Constants** (`src/constants/`): `BASE_WEIGHT`, `SESSION_CARD_BOOST`, `UPVOTE_BONUS`, `UPVOTE_BONUS_CAP`, `DOWNVOTE_MULTIPLIER`, `REVEAL_DELAY_MS` (12 000 ms), `POLL_INTERVAL_FOREGROUND_MS` (5 000), `POLL_INTERVAL_BACKGROUND_MS` (30 000), `DRINKING_LEVELS`, `SPICE_LEVELS` (full `LevelScale` objects with emoji/tooltip/llmDescription), `CARD_IMAGE_ASPECT_RATIO` (16:9), `MUTATION_RETRY_LIMIT`, `CONNECTION_CHECK_ENDPOINT`.
- **Utils** (`src/utils/contentClassifier.ts`): `hasRRatedContent`, `hasDrinkingContent`, `applyContentFloors` — raises content-level floors on a card, never lowers them.

## Backend Architecture (`apps/backend`)

**Stack:** Next.js App Router, better-sqlite3 (synchronous SQLite), TypeScript. Source root is `src/`.

```
src/
├── app/
│   ├── admin/          # Admin portal pages (Mantine UI) at /admin
│   └── api/            # Route handlers
├── db/
│   ├── init.ts         # Fresh-DB DDL only — never edit for prod schema changes
│   ├── migrate.ts      # Migration runner
│   └── migrations/     # Timestamp-named .ts files (YYYYMMDD_HHMMSS_name.ts)
└── lib/
    ├── auth/           # jwt.ts, withAuth.ts, withAdmin.ts, cookies.ts, rateLimiter.ts, password.ts
    ├── card-picker/    # Weighted draw algorithm
    ├── db/             # db.ts — better-sqlite3 singleton
    ├── repos/          # One file per entity; all prepared statements
    ├── services/       # authService, cardService, sessionService, aiAnalysisService
    └── utils/
```

**Request flow:** `middleware.ts` (CORS + security headers) → `src/app/api/**/route.ts` (Zod parse + `withAuth`/`withAdmin`) → `src/lib/services/` → `src/lib/repos/` → SQLite.

**Key patterns:**
- All queries use prepared statements — no string interpolation.
- Boolean columns use `boolToInt`/`intToBool` helpers (SQLite has no native bool).
- Migrations in `src/db/migrations/` tracked in a `_migrations` table. Supports `rollback` to reverse the last migration. The migration runner disables foreign keys inside the transaction — migration files themselves do not need to do this. Migration files export `up(db: Database): void` and `down(db: Database): void`; the filename is `YYYYMMDD_HHMMSS_description.ts`.
- Every API response: `{ ok, data/error, serverTimestamp }` envelope — no exceptions.
- Mutations return the full updated entity.
- `GET /api/health` — no auth, no DB; pure liveness probe.
- All route files must have `export const dynamic = "force-dynamic"` at the top.

**Environment variables** (see `.env.example`):
```
JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD
REGISTRATION_INVITATION_CODE   # empty = open registration
OPENAI_API_KEY, OPENAI_MODEL=gpt-4o
PORT=3001
```

### Card Draw Algorithm (`src/lib/card-picker/`)

1. Fetch candidates via `cardRepo.getDrawPool()` — respects `maxDrinkingLevel`, `maxSpiceLevel`, `includeGlobalCards`, `cardType`.
2. **Game tag filter:** universal cards (no tags) always pass; tagged cards require session to have an overlapping game filter.
3. **Requirement element filter:** cards with no requirements always pass; cards requiring elements pass only if all `requirementElementIds` are in `session.availableElementIds`. `undefined` availableElementIds = no filtering.
4. **Draw history:** already-drawn card IDs are **fully excluded** (not suppressed) until pool exhausted. In `NODE_ENV=development`, pool exhaustion triggers a reset.
5. **Weight calculation:** base `1.0` → session-born boost `×3.0` → upvote bonus `+0.2/net vote` (cap `+2.0`) → downvote penalty `×0.5` → floor `≥0`.
6. Weighted random selection from the remaining pool.

### Auth & JWT

**JWT payload:** `{ sub, type: "user"|"guest", email?, sessionId?, playerToken?, scopes[], iss, aud, iat, exp }`

- Access token: 15 min. Refresh token: opaque 40-byte hex, SHA-256 hashed in DB, 30-day TTL.
- Web: refresh token in HttpOnly `refresh_token` cookie (path `/api/auth`). Native: sent in request body.
- Guest JWTs include `sessionId` + `playerToken`; `withAuth` validates `playerToken` against `session_players.player_token` on every request. Host can reset a player's token to invalidate them.
- `withAuth` — validates any JWT. `withAdmin` — additionally checks `users.is_admin` and rejects guests.

**Claim flow** (`POST /api/auth/claim`): guest JWT in `Authorization` + credentials in body. Atomically sets `session_players.user_id`; all prior guest draws/votes preserved. Returns `AuthResponse` + sets refresh cookie. `409` if registered user already in session.

### AI Card Analysis

`aiAnalysisService` uses OpenAI (model + key configurable via `app_settings` table in admin UI) to categorize cards. `POST /api/admin/cards/analyze` accepts up to 100 card IDs and returns `CardAnalysisResult[]` with suggested tags, spice/drinking levels, and requirement elements.

### Media

`POST /api/media` — upload image (max 5 MB, JPEG/PNG/GIF). Returns `mediaId` UUID. Referenced by `CardVersion.imageId`. `media.imageYOffset` (0–1) controls vertical crop position (`object-position: center {n*100}%`) — stored on the media record, not the card version.

### Admin Portal

Mantine UI at `/admin`. Protected by a separate admin session (not user JWT) managed by `AdminSessionContext` / `AdminSessionProvider`. Admins can: manage cards (analyze, promote/demote global, transfer ownership), manage sessions, games, requirement elements, invitation codes, users, and app settings.

**Admin page patterns:**
- All admin pages are Next.js Client Components (`"use client"` at the top).
- `useAdminFetch()` — hook from `@/lib/admin/useAdminFetch` that attaches admin session credentials to every fetch. Use for all admin API calls.
- `useAdminSession()` — hook from `@/lib/admin/useAdminSession` that returns `{ user, isLoading, logout }`. Only needed if rendering the logged-in admin's info.
- UI uses Mantine v7: `Table`, `Modal`, `Drawer`, `Switch`, `Badge`, `Button`, `Stack`, `Group`, `Text`, `TextInput`, `Center`, `Loader`, `ActionIcon`, `Tooltip`, `ScrollArea`, `Divider`, `Title`.
- `notifications.show({ message: "...", color: "green" })` for success; `color: "red"` for errors.
- Nav: add new pages to the `NAV_ITEMS` array in `apps/backend/src/app/admin/layout.tsx`.

### Card Nomination / Global Promotion

Card owners can nominate a card for global pool review (`POST /api/cards/:id/nominate` / `/unnominate`). Admin promotes (`/promote`) or demotes (`/demote`) it. `card.is_global` (admin-only field) marks globally available cards.

## Frontend Architecture (`apps/mobile`)

Targets **web browsers and native (iOS/Android) equally**. Native Capacitor features are optional enhancements with web fallbacks — the app must work in a plain browser.

**Stack:** Ionic 8, Capacitor 8, React 19, Vite 6, React Router v5, TanStack React Query.

### Provider Stack (App.tsx)
```
AuthProvider
  SessionProvider
    CardProvider
      TransferProvider
        AppHeaderProvider
          AppErrorBoundary
            NetworkStatusBanner
            IonApp > IonReactRouter > IonRouterOutlet  ← Suspense boundaries here
```

App startup: before rendering providers, prefetches `appConfigQueryOptions` and does a backend reachability check. Shows `PageSkeleton` while loading, `BackendErrorPage` on failure.

### Routes

All routes except `/` are `React.lazy` wrapped in `<Suspense fallback={<PageSkeleton />}>`.

**Registering a new route:** Add a `React.lazy` import near the other lazy imports at the top of `App.tsx`, then add a `<Route exact path="/your-path">` with `<Suspense fallback={<PageSkeleton />}>` inside `<IonRouterOutlet id="main-content">`, before the catch-all `<Route>` that redirects to `/`.

- **Open:** `/`, `/login`, `/register`, `/join/:code?`
- **Session member (any JWT):** `/game/:sessionId`, `/notifications`
- **Registered only:** `/game-settings` (create), `/game-settings/:sessionId` (edit), `/game-options/:sessionId/:playerId`, `/settings`, `/submit-card`, `/cards`
- **Any auth:** `/history`, `/history/:sessionId`, `/about`, `/invite-request`

### State — Domain Contexts

| Context | Key state | Key methods |
|---------|-----------|-------------|
| `AuthContext` | `user`, `isGuest`, `accessToken`, `isInitializing` | `login`, `register`, `logout`, `setGuestSession`, `upgradeFromGuest`, `updateCurrentUser` |
| `SessionContext` | `session`, `players`, `activePlayerId`, `devicePlayerIds`, `localPlayer` | `initSession`, `addDevicePlayer`, `setActivePlayer`, `clearSession`, `updateSession` |
| `CardContext` | `drawHistory: DrawEvent[]` | `addDrawEvent`, `updateDrawEvent`, `removeDrawEvent`, `clearHistory` |
| `TransferContext` | `pendingTransfers: CardTransfer[]` | `setPendingTransfers`, `removeTransfer`, `clearTransfers` |

### Loading & Transitions

- **Queries:** `useSuspenseQuery` everywhere. First visit suspends → skeleton; background refetches never re-suspend.
- **Mutations:** wrap in React 19 `startTransition`; `isPending` from `useTransition` drives a Mantine `<LoadingOverlay>`. Form stays rendered underneath for retry.
- **Suspense boundary rule:** always at route level, inside `IonReactRouter` and all Context providers. A boundary above a Context unmounts it on suspend, resetting state.

### Mobile UI Conventions

**Page structure** — every page follows this exact shape:
- `<IonPage>` → `<AppHeader />` → `<IonContent>` → `<div style={styles.root}>` with `flexDirection: "column"`, `backgroundColor: "var(--color-bg)"`, `paddingTop: "var(--space-5)"`, `paddingBottom: "var(--space-8)"`.
- Page title lives **inside the content area** in a `pageHeader` div, not in `<IonToolbar>`. `<AppHeader>` renders only the hamburger menu + optional title from context.
- Styles are defined as `const styles: Record<string, React.CSSProperties> = { ... }` at the bottom of the file.

**Back navigation** — universally `«` (U+00AB, left double angle quotation mark). Styled as:
```ts
backLink: {
    background: "none", border: "none",
    fontFamily: "var(--font-ui)", fontSize: "var(--text-subheading)",
    color: "var(--color-accent-primary)", cursor: "pointer",
    padding: 0, lineHeight: 1,
    minHeight: "44px", minWidth: "44px",
    display: "flex", alignItems: "center",
}
```
Never use `←`, `<`, or a text label like "Back". Place it as the first child of `pageHeader`.

**Hit targets** — all interactive elements (buttons, links, toggles) must be at least 44 × 44 px in the touch axis.

**Lists** — plain flex column `<div>`, each row `borderBottom: "1px solid var(--color-border)"`. No `<IonList>`.

**Modals** — `<IonModal>` for sheet editors; `<AppDialog>` (from `../components/AppDialog`) for confirmations. Pass `style={{ "--border-radius": "0" } as React.CSSProperties}` to `IonModal`.

**Empty states** — include a title + hint + optional CTA. Pick a random message with `useRef` at mount to avoid flicker.

**Mantine usage** — only `@mantine/hooks` is used in the mobile app (e.g. `useDebouncedValue`). Do not use Mantine UI components in mobile pages — use Ionic + plain HTML.

**Animations** — use `motion/react` (`AnimatePresence`, `motion.div`, etc.). Always gate animations behind `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

**CSS design tokens** (defined in `apps/mobile/src/theme/variables.css`):

| Token | Purpose |
|---|---|
| `--color-bg` | Page background |
| `--color-surface` | Card/input background |
| `--color-surface-elevated` | Elevated surfaces |
| `--color-border` | Dividers, input borders |
| `--color-text-primary` | Main text |
| `--color-text-secondary` | Muted/secondary text |
| `--color-accent-primary` | Links, back button, primary actions |
| `--color-accent-amber` | Selected state, toggle-on borders, warnings |
| `--color-accent-green` | Success states |
| `--color-danger` | Errors, destructive actions |
| `--font-display` | Headings (display/wordmark typeface) |
| `--font-ui` | Body text, buttons, labels |
| `--text-heading` | Page title font-size |
| `--text-subheading` | Section heading font-size |
| `--text-body` | Body copy font-size |
| `--text-label` | Button label font-size |
| `--text-caption` | Small/helper text font-size |
| `--space-1` … `--space-12` | Spacing scale (used in padding, gap, margin) |

Never use hardcoded hex colors or pixel values for spacing — always use these tokens.

### Forms

All forms use `react-hook-form` + `zodResolver`. Schema from `@chance/core` extended with user-facing messages via `.extend()`. API errors → `setError("root", ...)`. `IonInput` bridge:
```ts
onIonInput={(e) => register("field").onChange({ target: { value: String(e.detail.value ?? "") } })}
```

`CardEditor` (`src/components/CardEditor.tsx`) is `forwardRef` exposing `{ submitForm(), reset() }`. Manages `imagePreview` + `pendingImageId` for server-side cleanup on image replace. Uses Capacitor Camera + `browser-image-compression` for image capture.

**Card editability rules (MyCards page):** A card is read-only when `card.isGlobal === true` — only admins can edit global cards. The `MyCards` page surfaces this at two levels: a blue `GLOBAL` badge on the list tile, and inside the modal a banner + all form inputs disabled (`disabled={card.isGlobal || isPending}`) + no "Save changes" button. Inactive cards remain editable. `card.active` does not affect editability.

### ApiClient (`src/lib/api/client.ts`)

Singleton exported from `src/lib/api/index.ts`. 15s timeout via `AbortController`. All non-`/api/auth/` and non-`/api/config` requests wait on `authReadyPromise` (resolved by `AuthProvider` after hydration). Auto-refreshes on `401 + X-Token-Status: invalid`, replays once; concurrent refreshes are deduplicated. Returns `ApiResult<T>` — never throws.

Base URL: `VITE_API_URL` env var → `http://localhost:3000` in DEV → `""` (same-origin) in prod web.

### Session Polling

`refetchInterval` on game page — 5 s foreground, 30 s background. Background detection: Capacitor App state events (native) / Page Visibility API (web). Paused offline; resumes on reconnect. Poll endpoint: `GET /api/sessions/:id/state?since=<ISO>`.

### Local Storage

| Data | Native | Web |
|------|--------|-----|
| Registered refresh token | Capacitor Secure Storage (Keychain/Keystore) | HttpOnly cookie — no JS access |
| Access token | In-memory | In-memory |
| Guest JWT | In-memory only | In-memory only |
| Guest player token | `@capacitor/preferences` | `localStorage` |
| Device player IDs | `@capacitor/preferences` (keyed `device_players:{sessionId}`) | `localStorage` |

### Game Page

`src/pages/Game/` is broken into `index.tsx`, `GamePageContext`, `useGamePage.ts`, and `components/`. Key sub-components: `CardCarousel`, `CardDetailOverlay`, `CardRevealOverlay`, `DrawButton`, `ReparationsButton`, `PlayerActionSheet`, `ClaimAccountModal`.

**Draw modes:** `"live"` (normal), `"standard"`, `"game-changer"` (intro sound + "GAME CHANGER" pre-flip label + 3 s flip), `"reparations"` (separate drama: intro sound + 5 s hold + 2 s flip). `DevDrawPanel` (dev-only) forces draw mode without hitting the API.

**`descriptionShared`:** drawing player can reveal their hidden card description to all others via `POST /api/draw-events/:id/share-description`. Reflected in `DrawEvent.descriptionShared`.

## Browser Testing with openbrowser

Use the `mcp__plugin_openbrowser_openbrowser__execute_code` tool. Always extract functions from `__ns__` at the top of each code block — they don't persist between calls:

```python
navigate = __ns__['navigate']
click = __ns__['click']
input_text = __ns__['input_text']
wait = __ns__['wait']
evaluate = __ns__['evaluate']
browser = __ns__['browser']
send_keys = __ns__['send_keys']
scroll = __ns__['scroll']
```

**Always run against the local dev server** (`http://localhost:8100`), never production.

### Logging In

Standard form automation doesn't work with the login page — Ionic shadow DOM prevents `input_text` and `send_keys` from reaching React Hook Form. Instead, invoke the `login` function directly via the React fiber:

```python
result = await evaluate("""
    (async () => {
        function findFiberByType(node, name, depth=0) {
            if (!node || depth > 200) return null;
            const n = node.type?.displayName || node.type?.name || '';
            if (n.includes(name)) return node;
            let r = null;
            if (node.child) r = findFiberByType(node.child, name, depth+1);
            if (!r && node.sibling) r = findFiberByType(node.sibling, name, depth+1);
            return r;
        }
        const container = document.getElementById('root');
        const fiberKey = Object.keys(container).find(k => k.startsWith('__reactContainer'));
        const fiber = container[fiberKey];
        const authFiber = findFiberByType(fiber, 'Auth');
        // Hook index 3, memoizedState[0] is the login fn (useCallback)
        let hook = authFiber.memoizedState;
        for (let i = 0; i < 3; i++) hook = hook.next;
        const loginFn = hook.memoizedState[0];
        return await loginFn('EMAIL', 'PASSWORD');
    })()
""")
```

After login, navigate directly to the target route — no redirect happens automatically:
```python
await navigate("http://localhost:8100/cards")
await wait(3)
```

### Interacting with Forms

**Ionic `IonInput` elements** (used on login, register, etc.): standard `input_text` and `send_keys` don't register with RHF. Use the fiber-based `login` call above instead of trying to type into these forms.

**Plain `<input>` elements** (used in `CardEditor` and most non-Ionic forms): `send_keys` fires key events but NOT the `input` event React's RHF watches. Use the native value setter trick to trigger React's onChange:

```python
result = await evaluate("""
    function findByPlaceholder(placeholder) {
        function walk(root) {
            if (!root) return null;
            if (root.tagName === 'INPUT' && root.placeholder === placeholder) return root;
            if (root.shadowRoot) { const f = walk(root.shadowRoot); if (f) return f; }
            for (const c of (root.children || [])) { const f = walk(c); if (f) return f; }
            return null;
        }
        return walk(document.body);
    }
    const inp = findByPlaceholder('Title');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, 'New value');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return inp.value;
""")
```

### Scrolling in Modals

Ionic modals have an inner scroll container. Find its index in `browser.get_state_as_text()` — it appears as `|SCROLL[NNNN]<div />`. Pass that index as the third argument to `scroll()`:

```python
state = await browser.get_state_as_text()
# Look for: SCROLL[2339]<div /> (X pages above, Y pages below)
await scroll(True, 5, 2339)  # scroll down 5 pages inside modal
```

### Intercepting Network Requests

To verify what API calls fire on a user action:

```python
await evaluate("""
    const orig = window.fetch;
    window.__fetchLog__ = [];
    window.fetch = async function(...args) {
        const url = String(args[0]).substring(0, 100);
        const method = (args[1] || {}).method || 'GET';
        const resp = await orig.apply(this, args);
        const clone = resp.clone();
        const text = await clone.text();
        window.__fetchLog__.push({ url, method, status: resp.status, body: text.substring(0, 300) });
        return resp;
    };
""")
# ... perform the action ...
result = await evaluate("return JSON.stringify(window.__fetchLog__ || [])")
print(result)
```

### Global Cards

Cards with `isGlobal = true` return 403 on PATCH for non-admin users. When testing card save on `/cards`, pick an INACTIVE or non-global card. The MyCards UI surfaces this at the list level (blue GLOBAL badge on tiles) and modal level (banner + disabled form + no Save button), so only editable cards ever reach the save flow.

## Slash Commands (Project Skills)

| Command | When to use |
|---|---|
| `/implement` | General full-stack implementation guide — reference for layer-by-layer order, domain model, auth model, and key constraints |
| `/new-feature` | Scaffold a complete new feature: core schema → migration → repo → service → API route → mobile client + UI |
| `/new-screen` | Create a new mobile page with the correct Ionic/RQ/RHF/CSS-var patterns + register in App.tsx |
| `/new-api-route` | Create a new backend route with correct auth wrapper, Zod parse, and response envelope |
| `/new-migration` | Create a timestamped DB migration with `up`/`down`, update init.ts and the repo |
| `/new-admin-page` | Create a Mantine admin page with Table + Drawer/Modal pattern + register in nav |
| `/mobile-login` | Log in to the local dev frontend via the React fiber (workaround for Ionic shadow DOM) |
| `/verify` | Run the app and verify a change works end-to-end in the browser |

## API Design Conventions

- `withAuth` validates any JWT; most gameplay endpoints (draw, vote, transfer) only require it.
- Registered-only: `POST /api/sessions` (create), `POST /api/cards` (submit), account management.
- Guest JWTs are ephemeral — never persisted; cleared when session ends or app restarts.
- **Single-device play is primary.** Host creates session; others join as guests on the same phone via the player switcher. Multi-device is also supported.
- Invitation codes: single-use, admin-created, optional expiry; consumed atomically on register.
- Game tags: zero rows = universal card. One or more rows = session must have an overlapping game filter.
- Cards are deactivated (`active = false`) — no hard delete. Deactivated cards are excluded from draw pools but draw history is preserved.
- `card.created_in_session_id` (nullable FK → sessions) — used for game-lineage pool tier and the 3× session boost.
- `session_players.card_sharing` (`'none' | 'mine'`, default `'mine'`) controls the registered player's pool contribution.
- Flags are a lightweight report signal only — no automatic hold.
