import { type ErrorCodeType as ErrorCode } from "@chance/core";
import type {
    ApiClient,
    ApiResult,
    ApiSuccess,
    AuthResponse,
    Card,
    CardTransfer,
    CardVersion,
    ChangePasswordRequest,
    CreateSessionRequest,
    DrawEvent,
    FilterSettings,
    GetAllCardsFilters,
    JoinByCodeRequest,
    JoinByCodeResponse,
    LoginRequest,
    Player,
    RegisterRequest,
    Session,
    SessionState,
    SubmitCardRequest,
    UpdateUserRequest,
    User,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString();
const id = () => Math.random().toString(36).slice(2, 10);

function ok<T>(data: T): ApiSuccess<T> {
    return { ok: true, data, serverTimestamp: ts() };
}

function fail(code: ErrorCode, message: string): ApiResult<never> {
    return { ok: false, error: { code, message }, serverTimestamp: ts() };
}

// ─── Seed data ───────────────────────────────────────────────────────────────

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
    drinksPerHourThisPlayer: 0,
    avgDrinksPerHourAllPlayers: 0,
    isFamilySafe: true,
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
    drinksPerHourThisPlayer: 0,
    avgDrinksPerHourAllPlayers: 0,
    isFamilySafe: true,
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
    drinksPerHourThisPlayer: 0,
    avgDrinksPerHourAllPlayers: 0,
    isFamilySafe: false,
    isGameChanger: false,
    gameTags: ["Catan"],
    authoredByUserId: "user-demo",
    createdAt: "2026-01-03T00:00:00.000Z",
};
const DEMO_CARD_3: Card = {
    id: "card-3",
    authorUserId: "user-demo",
    active: false,
    isGlobal: false,
    createdInSessionId: null,
    currentVersionId: "cv-3-v1",
    currentVersion: DEMO_CARD_3_V1,
    createdAt: "2026-01-03T00:00:00.000Z",
};

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
    sessions: new Map(),
    players: new Map(),
    playerTokens: new Map(),
    drawEvents: new Map(),
    transfers: new Map(),
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
        refreshToken: string
    ): Promise<ApiResult<Pick<AuthResponse, "accessToken" | "refreshToken">>> {
        if (!refreshToken.startsWith("fake-refresh-")) {
            return fail("AUTHENTICATION_ERROR", "Invalid refresh token.");
        }
        const userId = refreshToken.replace("fake-refresh-", "");
        return ok({ accessToken: `fake-access-${userId}`, refreshToken: `fake-refresh-${userId}` });
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
            joinCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
            filterSettings: req.filterSettings,
            status: "active",
            createdAt: ts(),
            expiresAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
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
                    // Same registered user rejoining — allow
                    existing.active = true;
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
            cardSharing: isRegistered ? "network" : null,
        };
        state.players.get(session.id)!.push(player);

        // Guest players get a device-binding token; registered players don't
        const playerToken = isRegistered ? null : id();
        if (playerToken) state.playerTokens.set(player.id, playerToken);

        return ok({ session, player, accessToken: `fake-guest-${player.id}`, playerToken });
    }

    async getSessionState(sessionId: string, _since?: string): Promise<ApiResult<SessionState>> {
        const session = state.sessions.get(sessionId);
        if (!session) return fail("NOT_FOUND_ERROR", "Session not found.");
        return ok({
            session,
            players: state.players.get(sessionId) ?? [],
            drawEvents: state.drawEvents.get(sessionId) ?? [],
            pendingTransfers: (state.transfers.get(sessionId) ?? []).filter(
                (t) => t.status === "pending"
            ),
            serverTimestamp: ts(),
        });
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

    async submitCard(sessionId: string, req: SubmitCardRequest): Promise<ApiResult<Card>> {
        const cardId = id();
        const version: CardVersion = {
            id: id(),
            cardId,
            versionNumber: 1,
            title: req.title,
            description: req.description,
            hiddenDescription: req.hiddenDescription,
            imageUrl: req.imageUrl ?? null,
            drinksPerHourThisPlayer: req.drinksPerHourThisPlayer,
            avgDrinksPerHourAllPlayers: req.avgDrinksPerHourAllPlayers,
            isFamilySafe: req.isFamilySafe,
            isGameChanger: req.isGameChanger,
            gameTags: req.gameTags,
            authoredByUserId: state.currentUser?.id ?? "unknown",
            createdAt: ts(),
        };
        const card: Card = {
            id: cardId,
            authorUserId: state.currentUser?.id ?? "unknown",
            active: true,
            isGlobal: false,
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
        const version: CardVersion = {
            id: id(),
            cardId,
            versionNumber: 1,
            title: req.title,
            description: req.description,
            hiddenDescription: req.hiddenDescription,
            imageUrl: req.imageUrl ?? null,
            drinksPerHourThisPlayer: req.drinksPerHourThisPlayer,
            avgDrinksPerHourAllPlayers: req.avgDrinksPerHourAllPlayers,
            isFamilySafe: req.isFamilySafe,
            isGameChanger: req.isGameChanger,
            gameTags: req.gameTags,
            authoredByUserId: state.currentUser?.id ?? "unknown",
            createdAt: ts(),
        };
        const card: Card = {
            id: cardId,
            authorUserId: state.currentUser?.id ?? "unknown",
            active: true,
            isGlobal: false,
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

    async flagCard(_cardId: string): Promise<ApiResult<void>> {
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

    async resolveCard(drawEventId: string): Promise<ApiResult<DrawEvent>> {
        for (const events of state.drawEvents.values()) {
            const event = events.find((e) => e.id === drawEventId);
            if (event) {
                event.resolved = true;
                return ok(event);
            }
        }
        return fail("NOT_FOUND_ERROR", "Draw event not found.");
    }

    // ── Transfers ─────────────────────────────────────────────────────────────

    async createTransfer(
        drawEventId: string,
        toPlayerId: string
    ): Promise<ApiResult<CardTransfer>> {
        let sessionId: string | undefined;
        for (const [sid, events] of state.drawEvents.entries()) {
            if (events.some((e) => e.id === drawEventId)) {
                sessionId = sid;
                break;
            }
        }
        if (!sessionId) return fail("NOT_FOUND_ERROR", "Draw event not found.");

        const transfer: CardTransfer = {
            id: id(),
            fromPlayerId: "unknown",
            toPlayerId,
            drawEventId,
            status: "pending",
            createdAt: ts(),
        };
        state.transfers.get(sessionId)!.push(transfer);
        return ok(transfer);
    }

    async respondToTransfer(
        transferId: string,
        status: "accepted" | "rejected"
    ): Promise<ApiResult<CardTransfer>> {
        for (const transfers of state.transfers.values()) {
            const transfer = transfers.find((t) => t.id === transferId);
            if (transfer) {
                transfer.status = status;
                return ok(transfer);
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
        const newVersion: CardVersion = {
            id: id(),
            cardId,
            versionNumber: versions.length + 1,
            title: req.title,
            description: req.description,
            hiddenDescription: req.hiddenDescription,
            imageUrl: req.imageUrl ?? null,
            drinksPerHourThisPlayer: req.drinksPerHourThisPlayer,
            avgDrinksPerHourAllPlayers: req.avgDrinksPerHourAllPlayers,
            isFamilySafe: req.isFamilySafe,
            isGameChanger: req.isGameChanger,
            gameTags: req.gameTags,
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
