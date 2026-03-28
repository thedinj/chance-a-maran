import type {
    ApiClient,
    ApiResult,
    ApiSuccess,
    AuthResponse,
    Card,
    CardTransfer,
    CardVersion,
    CreateSessionRequest,
    DrawEvent,
    FilterSettings,
    GuestJoinRequest,
    GuestJoinResponse,
    JoinByCodeRequest,
    JoinByCodeResponse,
    LoginRequest,
    Player,
    RegisterRequest,
    Session,
    SessionState,
    SubmitCardRequest,
    User,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString();
const id = () => Math.random().toString(36).slice(2, 10);

function ok<T>(data: T): ApiSuccess<T> {
    return { ok: true, data, serverTimestamp: ts() };
}

function fail(code: string, message: string): ApiResult<never> {
    return { ok: false, error: { code, message }, serverTimestamp: ts() };
}

// ─── Seed data ───────────────────────────────────────────────────────────────

const DEMO_USER: User = {
    id: "user-demo",
    email: "demo@chance.app",
    displayName: "Demo Host",
    isAdmin: false,
};

const DEMO_CARD_VERSION: CardVersion = {
    id: "cv-1",
    cardId: "card-1",
    versionNumber: 1,
    title: "The Dare",
    description: "Do your best impression of someone at the table.",
    hiddenDescription: false,
    imageUrl: null,
    isDrinking: false,
    isFamilySafe: true,
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

// ─── In-memory state ─────────────────────────────────────────────────────────

interface FakeState {
    currentUser: User | null;
    sessions: Map<string, Session>;
    players: Map<string, Player[]>;
    drawEvents: Map<string, DrawEvent[]>;
    transfers: Map<string, CardTransfer[]>;
}

const state: FakeState = {
    currentUser: null,
    sessions: new Map(),
    players: new Map(),
    drawEvents: new Map(),
    transfers: new Map(),
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
        if (!session) return fail("NOT_FOUND", "Session not found or no longer active.");

        const existing = (state.players.get(session.id) ?? []).find(
            (p) => p.displayName.trim().toLowerCase() === req.displayName.trim().toLowerCase()
        );
        if (existing) {
            existing.active = true;
            return ok({ session, player: existing, accessToken: `fake-guest-${existing.id}` });
        }

        const player: Player = {
            id: id(),
            sessionId: session.id,
            displayName: req.displayName.trim(),
            userId: state.currentUser?.id ?? null,
            active: true,
        };
        state.players.get(session.id)!.push(player);
        return ok({ session, player, accessToken: `fake-guest-${player.id}` });
    }

    async getSessionState(sessionId: string, _since?: string): Promise<ApiResult<SessionState>> {
        const session = state.sessions.get(sessionId);
        if (!session) return fail("NOT_FOUND", "Session not found.");
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
        if (!session) return fail("NOT_FOUND", "Session not found.");
        session.filterSettings = filterSettings;
        return ok(session);
    }

    async endSession(sessionId: string): Promise<ApiResult<void>> {
        const session = state.sessions.get(sessionId);
        if (!session) return fail("NOT_FOUND", "Session not found.");
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
        if (!session) return fail("NOT_FOUND", "Session not found.");
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

    async submitCard(_sessionId: string, req: SubmitCardRequest): Promise<ApiResult<Card>> {
        const version: CardVersion = {
            id: id(),
            cardId: id(),
            versionNumber: 1,
            title: req.title,
            description: req.description,
            hiddenDescription: req.hiddenDescription,
            imageUrl: req.imageUrl ?? null,
            isDrinking: req.isDrinking,
            isFamilySafe: req.isFamilySafe,
            gameTags: req.gameTags,
            authoredByUserId: state.currentUser?.id ?? "unknown",
            createdAt: ts(),
        };
        const card: Card = {
            id: version.cardId,
            authorUserId: state.currentUser?.id ?? "unknown",
            active: true,
            currentVersionId: version.id,
            currentVersion: version,
            createdAt: ts(),
        };
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
        return fail("NOT_FOUND", "Draw event not found.");
    }

    async resolveCard(drawEventId: string): Promise<ApiResult<DrawEvent>> {
        for (const events of state.drawEvents.values()) {
            const event = events.find((e) => e.id === drawEventId);
            if (event) {
                event.resolved = true;
                return ok(event);
            }
        }
        return fail("NOT_FOUND", "Draw event not found.");
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
        if (!sessionId) return fail("NOT_FOUND", "Draw event not found.");

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
        return fail("NOT_FOUND", "Transfer not found.");
    }
}

export { DEMO_USER, DEMO_CARD };
