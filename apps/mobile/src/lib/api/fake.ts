import { type ErrorCodeType as ErrorCode } from "@chance/core";
import type {
    ApiClient,
    ApiResult,
    ApiSuccess,
    AppConfig,
    AuthResponse,
    Card,
    CardTransfer,
    CardVersion,
    ChangePasswordRequest,
    CreateSessionRequest,
    DrawEvent,
    FilterSettings,
    Game,
    GetAllCardsFilters,
    JoinByCodeRequest,
    JoinByCodeResponse,
    LoginRequest,
    Player,
    RegisterRequest,
    Session,
    SessionState,
    SessionSummary,
    SubmitCardRequest,
    UpdateUserRequest,
    User,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString();
const id = () => Math.random().toString(36).slice(2, 10);

const JOIN_CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const JOIN_CODE_DIGITS = "23456789";

function randomChar(chars: string): string {
    return chars[Math.floor(Math.random() * chars.length)]!;
}

function createJoinCode(length = 6): string {
    return Array.from({ length }, (_, index) =>
        index % 2 === 0 ? randomChar(JOIN_CODE_LETTERS) : randomChar(JOIN_CODE_DIGITS)
    ).join("");
}

function ok<T>(data: T): ApiSuccess<T> {
    return { ok: true, data, serverTimestamp: ts() };
}

function fail(code: ErrorCode, message: string): ApiResult<never> {
    return { ok: false, error: { code, message }, serverTimestamp: ts() };
}

// ─── Seed data ───────────────────────────────────────────────────────────────

const DEMO_GAME_CATAN: Game = { id: "game-catan", name: "Catan", slug: "catan" };
const DEMO_GAME_CODENAMES: Game = { id: "game-codenames", name: "Codenames", slug: "codenames" };
const DEMO_GAME_TTR: Game = {
    id: "game-ttr",
    name: "Ticket to Ride",
    slug: "ticket-to-ride",
};

const DEMO_GAMES: Game[] = [DEMO_GAME_CATAN, DEMO_GAME_CODENAMES, DEMO_GAME_TTR];

const DEMO_USER: User = {
    id: "user-demo",
    email: "demo@chance.app",
    displayName: "Demo Host",
    isAdmin: false,
    createdAt: "2026-01-01T00:00:00.000Z",
};

const DEMO_CARD_VERSION: CardVersion = {
    id: "cv-1",
    cardId: "card-1",
    versionNumber: 1,
    title: "The Dare", // - Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    description: "Do your best impression of someone at the table." /*+
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum." +
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."*/,
    hiddenDescription: false,
    imageUrl: null,
    drinkingLevel: 0,
    spiceLevel: 0,
    isGameChanger: false,
    gameTags: [],
    authoredByUserId: "user-demo",
    createdAt: "2026-01-01T00:00:00.000Z",
};

const DEMO_CARD: Card = {
    id: "card-1",
    authorUserId: "user-demo",
    active: true,
    isGlobal: true,
    cardType: "standard",
    createdInSessionId: null,
    currentVersionId: "cv-1",
    currentVersion: DEMO_CARD_VERSION,
    createdAt: "2026-01-01T00:00:00.000Z",
};

// Second demo card — two versions, so the V2 badge shows
const DEMO_CARD_2_V1: CardVersion = {
    id: "cv-2-v1",
    cardId: "card-2",
    versionNumber: 1,
    title: "Truth or truth",
    description: "Tell the group something they don't know about you.",
    hiddenDescription: false,
    imageUrl: null,
    drinkingLevel: 0,
    spiceLevel: 0,
    isGameChanger: false,
    gameTags: [],
    authoredByUserId: "user-demo",
    createdAt: "2026-01-02T00:00:00.000Z",
};
const DEMO_CARD_2_V2: CardVersion = {
    ...DEMO_CARD_2_V1,
    id: "cv-2-v2",
    versionNumber: 2,
    description: "Tell the group something embarrassing about yourself.",
    createdAt: "2026-02-01T00:00:00.000Z",
};
const DEMO_CARD_2: Card = {
    id: "card-2",
    authorUserId: "user-demo",
    active: true,
    isGlobal: false,
    cardType: "standard",
    createdInSessionId: null,
    currentVersionId: "cv-2-v2",
    currentVersion: DEMO_CARD_2_V2,
    createdAt: "2026-01-02T00:00:00.000Z",
};

// Third demo card — inactive, Catan-tagged
const DEMO_CARD_3_V1: CardVersion = {
    id: "cv-3-v1",
    cardId: "card-3",
    versionNumber: 1,
    title: "Hot seat",
    description: "The player to your left gets to ask you any question.",
    hiddenDescription: true,
    imageUrl: null,
    drinkingLevel: 0,
    spiceLevel: 1,
    isGameChanger: false,
    gameTags: [DEMO_GAME_CATAN],
    authoredByUserId: "user-demo",
    createdAt: "2026-01-03T00:00:00.000Z",
};
const DEMO_CARD_3: Card = {
    id: "card-3",
    authorUserId: "user-demo",
    active: false,
    isGlobal: false,
    cardType: "standard",
    createdInSessionId: null,
    currentVersionId: "cv-3-v1",
    currentVersion: DEMO_CARD_3_V1,
    createdAt: "2026-01-03T00:00:00.000Z",
};

// ─── Demo Game Session & Players ─────────────────────────────────────────────

const DEMO_SESSION_ID = "session-demo-1";
const DEMO_HOST_PLAYER: Player = {
    id: "player-demo-host",
    sessionId: DEMO_SESSION_ID,
    displayName: "Demo Host",
    userId: DEMO_USER.id,
    active: true,
    cardSharing: "network",
};
const DEMO_GUEST_PLAYER_1: Player = {
    id: "player-demo-guest-1",
    sessionId: DEMO_SESSION_ID,
    displayName: "Alex",
    userId: null,
    active: true,
    cardSharing: null,
};
const DEMO_GUEST_PLAYER_2: Player = {
    id: "player-demo-guest-2",
    sessionId: DEMO_SESSION_ID,
    displayName: "Jordan",
    userId: null,
    active: true,
    cardSharing: null,
};

const DEMO_SESSION: Session = {
    id: DEMO_SESSION_ID,
    hostPlayerId: DEMO_HOST_PLAYER.id,
    name: "Game Night",
    joinCode: "DEMO",
    filterSettings: {
        maxDrinkingLevel: 3,
        maxSpiceLevel: 2,
        gameTags: [],
        includeGlobalCards: true,
    },
    status: "active",
    createdAt: "2026-02-15T18:30:00.000Z",
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: null,
};

// ─── Demo session history ─────────────────────────────────────────────────────

const DEMO_PAST_SESSION_1: SessionSummary = {
    id: "session-past-1",
    hostPlayerId: DEMO_HOST_PLAYER.id,
    name: "Friday Night Chaos",
    joinCode: "PAST1",
    filterSettings: {
        maxDrinkingLevel: 2,
        maxSpiceLevel: 1,
        gameTags: [],
        includeGlobalCards: true,
    },
    status: "ended",
    createdAt: "2026-03-28T20:00:00.000Z",
    expiresAt: "2026-04-13T20:00:00.000Z",
    endedAt: "2026-03-28T22:14:00.000Z",
    playerCount: 5,
    drawCount: 18,
};

const DEMO_PAST_SESSION_2: SessionSummary = {
    id: "session-past-2",
    hostPlayerId: DEMO_HOST_PLAYER.id,
    name: "Catan Night",
    joinCode: "PAST2",
    filterSettings: {
        maxDrinkingLevel: 1,
        maxSpiceLevel: 0,
        gameTags: ["catan"],
        includeGlobalCards: true,
    },
    status: "expired",
    createdAt: "2026-03-14T19:00:00.000Z",
    expiresAt: "2026-03-30T19:00:00.000Z",
    endedAt: null,
    playerCount: 4,
    drawCount: 11,
};

const DEMO_PAST_DRAW_EVENTS: DrawEvent[] = [
    {
        id: "de-past-1-1",
        sessionId: "session-past-1",
        playerId: "player-past-alex",
        cardVersionId: DEMO_CARD_VERSION.id,
        cardVersion: DEMO_CARD_VERSION,
        card: DEMO_CARD,
        drawnAt: "2026-03-28T22:10:00.000Z",
        revealedToAllAt: "2026-03-28T22:10:03.000Z",
        descriptionShared: false,
        resolved: true,
    },
    {
        id: "de-past-1-2",
        sessionId: "session-past-1",
        playerId: "player-past-jordan",
        cardVersionId: DEMO_CARD_2_V2.id,
        cardVersion: DEMO_CARD_2_V2,
        card: DEMO_CARD_2,
        drawnAt: "2026-03-28T22:05:00.000Z",
        revealedToAllAt: "2026-03-28T22:05:03.000Z",
        descriptionShared: true,
        resolved: false,
    },
    {
        id: "de-past-1-3",
        sessionId: "session-past-1",
        playerId: "player-past-host",
        cardVersionId: DEMO_CARD_3_V1.id,
        cardVersion: DEMO_CARD_3_V1,
        card: DEMO_CARD_3,
        drawnAt: "2026-03-28T22:00:00.000Z",
        revealedToAllAt: "2026-03-28T22:00:03.000Z",
        descriptionShared: false,
        resolved: false,
    },
];

const DEMO_PAST_PLAYERS: Player[] = [
    {
        id: "player-past-host",
        sessionId: "session-past-1",
        displayName: "Demo Host",
        userId: DEMO_USER.id,
        active: false,
        cardSharing: "network",
    },
    {
        id: "player-past-alex",
        sessionId: "session-past-1",
        displayName: "Alex",
        userId: null,
        active: false,
        cardSharing: null,
    },
    {
        id: "player-past-jordan",
        sessionId: "session-past-1",
        displayName: "Jordan",
        userId: null,
        active: false,
        cardSharing: null,
    },
];

// ─── In-memory state ─────────────────────────────────────────────────────────

interface FakeState {
    currentUser: User | null;
    sessions: Map<string, Session>;
    players: Map<string, Player[]>;
    /** Server-side player_token store — keyed by player ID. Not exposed to client. */
    playerTokens: Map<string, string>;
    drawEvents: Map<string, DrawEvent[]>;
    transfers: Map<string, CardTransfer[]>;
    cards: Map<string, Card>;
    /** All versions per card, oldest first. */
    cardVersions: Map<string, CardVersion[]>;
}

const state: FakeState = {
    currentUser: null,
    sessions: new Map([[DEMO_SESSION.id, DEMO_SESSION]]),
    players: new Map([
        [DEMO_SESSION_ID, [DEMO_HOST_PLAYER, DEMO_GUEST_PLAYER_1, DEMO_GUEST_PLAYER_2]],
    ]),
    playerTokens: new Map([
        [DEMO_GUEST_PLAYER_1.id, "token-guest-1"],
        [DEMO_GUEST_PLAYER_2.id, "token-guest-2"],
    ]),
    drawEvents: new Map([[DEMO_SESSION_ID, []]]),
    transfers: new Map([[DEMO_SESSION_ID, []]]),
    cards: new Map([
        [DEMO_CARD.id, DEMO_CARD],
        [DEMO_CARD_2.id, DEMO_CARD_2],
        [DEMO_CARD_3.id, DEMO_CARD_3],
    ]),
    cardVersions: new Map([
        [DEMO_CARD.id, [DEMO_CARD_VERSION]],
        [DEMO_CARD_2.id, [DEMO_CARD_2_V1, DEMO_CARD_2_V2]],
        [DEMO_CARD_3.id, [DEMO_CARD_3_V1]],
    ]),
};

// ─── FakeApiClient ────────────────────────────────────────────────────────────

export class FakeApiClient implements ApiClient {
    // ── App config ────────────────────────────────────────────────────────────

    async getAppConfig(): Promise<ApiResult<AppConfig>> {
        return ok({ inviteCodeRequired: true });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    async login(req: LoginRequest): Promise<ApiResult<AuthResponse>> {
        // Accept any credentials in fake mode — use "wrong@chance.app" to simulate failure
        if (req.email === "wrong@chance.app") {
            return fail("AUTHENTICATION_ERROR", "Invalid email or password.");
        }
        const user: User =
            req.email === DEMO_USER.email
                ? DEMO_USER
                : {
                      id: id(),
                      email: req.email,
                      displayName: req.email.split("@")[0]!,
                      isAdmin: false,
                      createdAt: ts(),
                  };
        state.currentUser = user;
        return ok({
            user,
            accessToken: `fake-access-${user.id}`,
            refreshToken: `fake-refresh-${user.id}`,
        });
    }

    async register(req: RegisterRequest): Promise<ApiResult<AuthResponse>> {
        if (!req.invitationCode) {
            return fail("INVITATION_CODE_ERROR", "An invitation code is required.");
        }
        const user: User = {
            id: id(),
            email: req.email,
            displayName: req.displayName,
            isAdmin: false,
            createdAt: ts(),
        };
        state.currentUser = user;
        return ok({
            user,
            accessToken: `fake-access-${user.id}`,
            refreshToken: `fake-refresh-${user.id}`,
        });
    }

    async logout(): Promise<ApiResult<void>> {
        state.currentUser = null;
        return ok(undefined);
    }

    async refreshTokens(
        refreshToken?: string
    ): Promise<ApiResult<Pick<AuthResponse, "accessToken" | "refreshToken">>> {
        if (!refreshToken || !refreshToken.startsWith("fake-refresh-")) {
            return fail("AUTHENTICATION_ERROR", "Invalid refresh token.");
        }
        const userId = refreshToken.replace("fake-refresh-", "");
        return ok({ accessToken: `fake-access-${userId}`, refreshToken: `fake-refresh-${userId}` });
    }

    async getMe(): Promise<ApiResult<User>> {
        if (!state.currentUser) return fail("AUTHENTICATION_ERROR", "Not authenticated.");
        return ok(state.currentUser);
    }

    async claimAccount(
        _guestAccessToken: string,
        credentials: LoginRequest | RegisterRequest
    ): Promise<ApiResult<AuthResponse>> {
        return this.login(credentials as LoginRequest);
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    async createSession(req: CreateSessionRequest): Promise<ApiResult<Session>> {
        if (!state.currentUser) return fail("AUTHENTICATION_ERROR", "Not authenticated.");
        const sessionId = id();
        const hostPlayer: Player = {
            id: id(),
            sessionId,
            displayName: state.currentUser.displayName,
            userId: state.currentUser.id,
            active: true,
            cardSharing: "network",
        };
        const session: Session = {
            id: sessionId,
            hostPlayerId: hostPlayer.id,
            name: req.name,
            joinCode: createJoinCode(),
            filterSettings: req.filterSettings,
            status: "active",
            createdAt: ts(),
            expiresAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
            endedAt: null,
        };
        state.sessions.set(sessionId, session);
        state.players.set(sessionId, [hostPlayer]);
        state.drawEvents.set(sessionId, []);
        state.transfers.set(sessionId, []);
        return ok(session);
    }

    async joinByCode(req: JoinByCodeRequest): Promise<ApiResult<JoinByCodeResponse>> {
        const session = Array.from(state.sessions.values()).find(
            (s) => s.joinCode === req.joinCode.toUpperCase() && s.status === "active"
        );
        if (!session) return fail("NOT_FOUND_ERROR", "Session not found or no longer active.");

        const existing = (state.players.get(session.id) ?? []).find(
            (p) => p.displayName.trim().toLowerCase() === req.displayName.trim().toLowerCase()
        );

        if (existing) {
            // Name match — registered players require account auth, not name entry
            if (existing.userId !== null) {
                if (state.currentUser?.id === existing.userId) {
                    // Same registered user rejoining — allow; apply updated cardSharing if provided
                    existing.active = true;
                    if (req.cardSharing) existing.cardSharing = req.cardSharing;
                    return ok({
                        session,
                        player: existing,
                        accessToken: `fake-guest-${existing.id}`,
                        playerToken: null,
                    });
                }
                return fail(
                    "AUTHENTICATION_ERROR",
                    "This name is linked to an account. Please sign in to rejoin."
                );
            }

            // Guest player — validate player_token
            const storedToken = state.playerTokens.get(existing.id);
            if (storedToken) {
                if (req.playerToken === storedToken) {
                    // Same device — silent resume
                    existing.active = true;
                    return ok({
                        session,
                        player: existing,
                        accessToken: `fake-guest-${existing.id}`,
                        playerToken: storedToken,
                    });
                }
                // Different device or impersonation attempt
                return fail(
                    "CONFLICT_ERROR",
                    "This name is already taken. Ask the host to free it up if you need to rejoin."
                );
            }

            // Token was reset by host (or first join edge case) — issue a new token
            const newToken = id();
            state.playerTokens.set(existing.id, newToken);
            existing.active = true;
            return ok({
                session,
                player: existing,
                accessToken: `fake-guest-${existing.id}`,
                playerToken: newToken,
            });
        }

        // No name match — new player
        const isRegistered = state.currentUser !== null;
        const player: Player = {
            id: id(),
            sessionId: session.id,
            displayName: req.displayName.trim(),
            userId: state.currentUser?.id ?? null,
            active: true,
            cardSharing: req.cardSharing ?? (isRegistered ? "network" : null),
        };
        state.players.get(session.id)!.push(player);

        // Guest players get a device-binding token; registered players don't
        const playerToken = isRegistered ? null : id();
        if (playerToken) state.playerTokens.set(player.id, playerToken);

        return ok({ session, player, accessToken: `fake-guest-${player.id}`, playerToken });
    }

    async getSessionState(sessionId: string, _since?: string): Promise<ApiResult<SessionState>> {
        // Check live sessions first, then past sessions
        const liveSession = state.sessions.get(sessionId);
        if (liveSession) {
            return ok({
                session: liveSession,
                players: state.players.get(sessionId) ?? [],
                drawEvents: state.drawEvents.get(sessionId) ?? [],
                pendingTransfers: state.transfers.get(sessionId) ?? [],
                serverTimestamp: ts(),
            });
        }
        // Past demo sessions
        if (sessionId === DEMO_PAST_SESSION_1.id) {
            return ok({
                session: DEMO_PAST_SESSION_1,
                players: DEMO_PAST_PLAYERS,
                drawEvents: DEMO_PAST_DRAW_EVENTS,
                pendingTransfers: [],
                serverTimestamp: ts(),
            });
        }
        if (sessionId === DEMO_PAST_SESSION_2.id) {
            return ok({
                session: DEMO_PAST_SESSION_2,
                players: [],
                drawEvents: [],
                pendingTransfers: [],
                serverTimestamp: ts(),
            });
        }
        return fail("NOT_FOUND_ERROR", "Session not found.");
    }

    async getSessionHistory(): Promise<ApiResult<SessionSummary[]>> {
        if (!state.currentUser) return fail("AUTHENTICATION_ERROR", "Not authenticated.");
        return ok([DEMO_PAST_SESSION_1, DEMO_PAST_SESSION_2]);
    }

    async getActiveSessions(): Promise<ApiResult<SessionSummary[]>> {
        if (!state.currentUser) return fail("AUTHENTICATION_ERROR", "Not authenticated.");
        const activeSummaries: SessionSummary[] = [];
        for (const session of state.sessions.values()) {
            if (session.status !== "active") continue;
            const players = state.players.get(session.id) ?? [];
            const isParticipant = players.some((p) => p.userId === state.currentUser!.id);
            if (!isParticipant) continue;
            const drawCount = (state.drawEvents.get(session.id) ?? []).length;
            activeSummaries.push({ ...session, playerCount: players.length, drawCount });
        }
        return ok(activeSummaries);
    }

    async updateSessionFilters(
        sessionId: string,
        filterSettings: FilterSettings
    ): Promise<ApiResult<Session>> {
        const session = state.sessions.get(sessionId);
        if (!session) return fail("NOT_FOUND_ERROR", "Session not found.");
        session.filterSettings = filterSettings;
        return ok(session);
    }

    async endSession(sessionId: string): Promise<ApiResult<void>> {
        const session = state.sessions.get(sessionId);
        if (!session) return fail("NOT_FOUND_ERROR", "Session not found.");
        session.status = "ended";
        session.endedAt = new Date().toISOString();
        return ok(undefined);
    }

    async leaveSession(sessionId: string, playerId: string): Promise<ApiResult<void>> {
        const players = state.players.get(sessionId) ?? [];
        const player = players.find((p) => p.id === playerId);
        if (player) player.active = false;
        return ok(undefined);
    }

    // ── Cards ─────────────────────────────────────────────────────────────────

    async drawCard(sessionId: string, playerId: string): Promise<ApiResult<DrawEvent>> {
        const session = state.sessions.get(sessionId);
        if (!session) return fail("NOT_FOUND_ERROR", "Session not found.");
        const drawEvent: DrawEvent = {
            id: id(),
            sessionId,
            playerId,
            cardVersionId: DEMO_CARD_VERSION.id,
            cardVersion: DEMO_CARD_VERSION,
            card: DEMO_CARD,
            drawnAt: ts(),
            revealedToAllAt: null,
            descriptionShared: false,
            resolved: false,
        };
        state.drawEvents.get(sessionId)!.push(drawEvent);
        // Simulate reveal delay
        setTimeout(() => {
            drawEvent.revealedToAllAt = new Date().toISOString();
        }, 3000);
        return ok(drawEvent);
    }

    async drawReparationsCard(sessionId: string, playerId: string): Promise<ApiResult<DrawEvent>> {
        // Reuse drawCard logic — fake client doesn't distinguish pool types
        return this.drawCard(sessionId, playerId);
    }

    async submitCard(sessionId: string, req: SubmitCardRequest): Promise<ApiResult<Card>> {
        const cardId = id();
        const resolvedGameTags = req.gameTags
            .map((gid) => DEMO_GAMES.find((g) => g.id === gid))
            .filter((g): g is Game => g !== undefined);
        const version: CardVersion = {
            id: id(),
            cardId,
            versionNumber: 1,
            title: req.title,
            description: req.description,
            hiddenDescription: req.hiddenDescription,
            imageUrl: req.imageUrl ?? null,
            drinkingLevel: req.drinkingLevel,
            spiceLevel: req.spiceLevel,
            isGameChanger: req.isGameChanger,
            gameTags: resolvedGameTags,
            authoredByUserId: state.currentUser?.id ?? "unknown",
            createdAt: ts(),
        };
        const card: Card = {
            id: cardId,
            authorUserId: state.currentUser?.id ?? "unknown",
            active: true,
            isGlobal: false,
            cardType: req.cardType,
            createdInSessionId: sessionId || null,
            currentVersionId: version.id,
            currentVersion: version,
            createdAt: ts(),
        };
        state.cards.set(cardId, card);
        state.cardVersions.set(cardId, [version]);
        return ok(card);
    }

    async submitCardOutsideSession(req: SubmitCardRequest): Promise<ApiResult<Card>> {
        const cardId = id();
        const resolvedGameTags = req.gameTags
            .map((gid) => DEMO_GAMES.find((g) => g.id === gid))
            .filter((g): g is Game => g !== undefined);
        const version: CardVersion = {
            id: id(),
            cardId,
            versionNumber: 1,
            title: req.title,
            description: req.description,
            hiddenDescription: req.hiddenDescription,
            imageUrl: req.imageUrl ?? null,
            drinkingLevel: req.drinkingLevel,
            spiceLevel: req.spiceLevel,
            isGameChanger: req.isGameChanger,
            gameTags: resolvedGameTags,
            authoredByUserId: state.currentUser?.id ?? "unknown",
            createdAt: ts(),
        };
        const card: Card = {
            id: cardId,
            authorUserId: state.currentUser?.id ?? "unknown",
            active: true,
            isGlobal: false,
            cardType: req.cardType,
            createdInSessionId: null,
            currentVersionId: version.id,
            currentVersion: version,
            createdAt: ts(),
        };
        state.cards.set(cardId, card);
        state.cardVersions.set(cardId, [version]);
        return ok(card);
    }

    async voteCard(_cardId: string, _direction: "up" | "down"): Promise<ApiResult<void>> {
        return ok(undefined);
    }

    async clearVote(_cardId: string): Promise<ApiResult<void>> {
        return ok(undefined);
    }

    async shareDescription(drawEventId: string): Promise<ApiResult<DrawEvent>> {
        for (const events of state.drawEvents.values()) {
            const event = events.find((e) => e.id === drawEventId);
            if (event) {
                event.descriptionShared = true;
                return ok(event);
            }
        }
        return fail("NOT_FOUND_ERROR", "Draw event not found.");
    }

    async resolveCard(drawEventId: string, resolved: boolean): Promise<ApiResult<DrawEvent>> {
        for (const events of state.drawEvents.values()) {
            const event = events.find((e) => e.id === drawEventId);
            if (event) {
                event.resolved = resolved;
                return ok({ ...event });
            }
        }
        return fail("NOT_FOUND_ERROR", "Draw event not found.");
    }

    // ── Transfers ─────────────────────────────────────────────────────────────

    async createTransfer(
        drawEventId: string,
        fromPlayerId: string,
        toPlayerId: string
    ): Promise<ApiResult<CardTransfer>> {
        let sessionId: string | undefined;
        for (const [sid, events] of state.drawEvents.entries()) {
            if (events.find((e) => e.id === drawEventId)) {
                sessionId = sid;
                break;
            }
        }
        if (!sessionId) return fail("NOT_FOUND_ERROR", "Draw event not found.");

        // Auto-cancel any existing pending transfer for this draw event
        const existing = state.transfers.get(sessionId)!;
        const prevIdx = existing.findIndex((t) => t.drawEventId === drawEventId);
        if (prevIdx !== -1) existing.splice(prevIdx, 1);

        const transfer: CardTransfer = {
            id: id(),
            fromPlayerId,
            toPlayerId,
            drawEventId,
            createdAt: ts(),
        };
        existing.push(transfer);
        return ok(transfer);
    }

    async acceptTransfer(
        transferId: string,
        _acceptingPlayerId: string
    ): Promise<ApiResult<DrawEvent>> {
        for (const [sid, transfers] of state.transfers.entries()) {
            const idx = transfers.findIndex((t) => t.id === transferId);
            if (idx === -1) continue;
            const transfer = transfers[idx]!;
            transfers.splice(idx, 1);

            const events = state.drawEvents.get(sid) ?? [];
            const origIdx = events.findIndex((e) => e.id === transfer.drawEventId);
            if (origIdx === -1) return fail("NOT_FOUND_ERROR", "Draw event not found.");
            const orig = events[origIdx]!;

            const newEvent: DrawEvent = {
                ...orig,
                id: id(),
                playerId: transfer.toPlayerId,
                drawnAt: ts(),
                revealedToAllAt: ts(),
            };
            events.splice(origIdx, 1);
            events.push(newEvent);
            return ok({ ...newEvent });
        }
        return fail("NOT_FOUND_ERROR", "Transfer not found.");
    }

    async cancelTransfer(
        transferId: string,
        _requestingPlayerId: string
    ): Promise<ApiResult<void>> {
        for (const transfers of state.transfers.values()) {
            const idx = transfers.findIndex((t) => t.id === transferId);
            if (idx !== -1) {
                transfers.splice(idx, 1);
                return ok(undefined);
            }
        }
        return fail("NOT_FOUND_ERROR", "Transfer not found.");
    }

    // ── User management ───────────────────────────────────────────────────────

    async updateUser(req: UpdateUserRequest): Promise<ApiResult<User>> {
        if (!state.currentUser) return fail("AUTHENTICATION_ERROR", "Not authenticated.");
        if (req.displayName !== undefined) state.currentUser.displayName = req.displayName;
        if (req.email !== undefined) state.currentUser.email = req.email;
        return ok({ ...state.currentUser });
    }

    async changePassword(req: ChangePasswordRequest): Promise<ApiResult<void>> {
        if (!state.currentUser) return fail("AUTHENTICATION_ERROR", "Not authenticated.");
        // Fake: reject if current password is "wrong"
        if (req.currentPassword === "wrong") {
            return fail("AUTHENTICATION_ERROR", "Current password is incorrect.");
        }
        return ok(undefined);
    }

    // ── Player management ─────────────────────────────────────────────────────

    async updatePlayerSettings(
        sessionId: string,
        playerId: string,
        patch: { displayName?: string; cardSharing?: "none" | "mine" | "network" }
    ): Promise<ApiResult<Player>> {
        const players = state.players.get(sessionId) ?? [];
        const player = players.find((p) => p.id === playerId);
        if (!player) return fail("NOT_FOUND_ERROR", "Player not found.");
        if (patch.cardSharing !== undefined && player.userId === null) {
            return fail("AUTHORIZATION_ERROR", "Guests cannot set card sharing.");
        }
        Object.assign(player, patch);
        return ok({ ...player });
    }

    async resetPlayerToken(sessionId: string, playerId: string): Promise<ApiResult<void>> {
        const players = state.players.get(sessionId) ?? [];
        const player = players.find((p) => p.id === playerId);
        if (!player) return fail("NOT_FOUND_ERROR", "Player not found.");
        if (player.userId !== null) {
            return fail("AUTHORIZATION_ERROR", "Cannot reset identity for a registered player.");
        }
        state.playerTokens.delete(playerId);
        return ok(undefined);
    }

    // ── Images ────────────────────────────────────────────────────────────────

    async uploadImage(_file: File): Promise<ApiResult<{ imageId: string }>> {
        return ok({ imageId: `fake-img-${Date.now()}` });
    }

    resolveImageUrl(imagePath: string | null): string | null {
        if (!imagePath) return null;
        // In the fake client there's no real base URL — return the path as-is.
        return imagePath;
    }

    // ── Games ─────────────────────────────────────────────────────────────────

    async getGames(): Promise<ApiResult<Game[]>> {
        return ok([...DEMO_GAMES]);
    }

    // ── My Cards management ───────────────────────────────────────────────────

    async getMyCards(): Promise<ApiResult<Card[]>> {
        const userId = state.currentUser?.id;
        if (!userId) return fail("AUTHENTICATION_ERROR", "Not authenticated.");
        const cards = Array.from(state.cards.values()).filter((c) => c.authorUserId === userId);
        return ok(cards);
    }

    async getAllCards(filters?: GetAllCardsFilters): Promise<ApiResult<Card[]>> {
        if (!state.currentUser?.isAdmin) {
            return fail("AUTHORIZATION_ERROR", "Admin access required.");
        }
        let cards = Array.from(state.cards.values());
        if (filters?.search) {
            const q = filters.search.toLowerCase();
            cards = cards.filter((c) => c.currentVersion.title.toLowerCase().includes(q));
        }
        if (filters?.active !== undefined) {
            cards = cards.filter((c) => c.active === filters.active);
        }
        if (filters?.isGlobal !== undefined) {
            cards = cards.filter((c) => c.isGlobal === filters.isGlobal);
        }
        return ok(cards);
    }

    async updateCard(cardId: string, req: SubmitCardRequest): Promise<ApiResult<Card>> {
        const card = state.cards.get(cardId);
        if (!card) return fail("NOT_FOUND_ERROR", "Card not found.");
        const versions = state.cardVersions.get(cardId) ?? [];
        const resolvedGameTags = req.gameTags
            .map((gid) => DEMO_GAMES.find((g) => g.id === gid))
            .filter((g): g is Game => g !== undefined);
        const newVersion: CardVersion = {
            id: id(),
            cardId,
            versionNumber: versions.length + 1,
            title: req.title,
            description: req.description,
            hiddenDescription: req.hiddenDescription,
            imageUrl: req.imageUrl ?? null,
            drinkingLevel: req.drinkingLevel,
            spiceLevel: req.spiceLevel,
            isGameChanger: req.isGameChanger,
            gameTags: resolvedGameTags,
            authoredByUserId: state.currentUser?.id ?? "unknown",
            createdAt: ts(),
        };
        versions.push(newVersion);
        state.cardVersions.set(cardId, versions);
        card.currentVersionId = newVersion.id;
        card.currentVersion = newVersion;
        return ok({ ...card });
    }

    async deactivateCard(cardId: string): Promise<ApiResult<Card>> {
        const card = state.cards.get(cardId);
        if (!card) return fail("NOT_FOUND_ERROR", "Card not found.");
        card.active = false;
        return ok({ ...card });
    }

    async reactivateCard(cardId: string): Promise<ApiResult<Card>> {
        const card = state.cards.get(cardId);
        if (!card) return fail("NOT_FOUND_ERROR", "Card not found.");
        card.active = true;
        return ok({ ...card });
    }

    async getCardVersions(cardId: string): Promise<ApiResult<CardVersion[]>> {
        const versions = state.cardVersions.get(cardId);
        if (!versions) return fail("NOT_FOUND_ERROR", "Card not found.");
        return ok([...versions]);
    }

    async promoteToGlobal(cardId: string): Promise<ApiResult<Card>> {
        if (!state.currentUser?.isAdmin) {
            return fail("AUTHORIZATION_ERROR", "Admin access required.");
        }
        const card = state.cards.get(cardId);
        if (!card) return fail("NOT_FOUND_ERROR", "Card not found.");
        card.isGlobal = true;
        return ok({ ...card });
    }

    async demoteFromGlobal(cardId: string): Promise<ApiResult<Card>> {
        if (!state.currentUser?.isAdmin) {
            return fail("AUTHORIZATION_ERROR", "Admin access required.");
        }
        const card = state.cards.get(cardId);
        if (!card) return fail("NOT_FOUND_ERROR", "Card not found.");
        card.isGlobal = false;
        return ok({ ...card });
    }
}

export { DEMO_USER, DEMO_CARD };
