// ─── Primitive entity types ─────────────────────────────────────────────────

export interface User {
    id: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
}

/** Ephemeral game identity scoped to one Game Session. */
export interface Player {
    id: string;
    sessionId: string;
    displayName: string;
    /** Linked User account, if any. */
    userId: string | null;
    /** False when the host marks the player inactive. They can rejoin by re-entering the same name. */
    active: boolean;
}

export interface FilterSettings {
    ageAppropriate: boolean;
    drinking: boolean;
    /** One or more game names. Empty array = any game. */
    gameTags: string[];
}

export interface Session {
    id: string;
    /** Player ID of the host — host leaving ends the game. */
    hostPlayerId: string;
    name: string;
    joinCode: string;
    filterSettings: FilterSettings;
    status: "active" | "ended" | "expired";
    createdAt: string;
    /** Sessions expire automatically after 16 days. */
    expiresAt: string;
}

/** Immutable snapshot of a card at a point in time. Saves never overwrite; they create a new version. */
export interface CardVersion {
    id: string;
    cardId: string;
    versionNumber: number;
    title: string;
    description: string;
    /** If true, only the drawing player sees the description initially. They can choose to share it. */
    hiddenDescription: boolean;
    imageUrl: string | null;
    isDrinking: boolean;
    isFamilySafe: boolean;
    /** Empty = universal (eligible for any session). */
    gameTags: string[];
    authoredByUserId: string;
    createdAt: string;
}

export interface Card {
    id: string;
    authorUserId: string;
    active: boolean;
    currentVersionId: string;
    currentVersion: CardVersion;
    createdAt: string;
}

export interface DrawEvent {
    id: string;
    sessionId: string;
    playerId: string;
    cardVersionId: string;
    cardVersion: CardVersion;
    drawnAt: string;
    /** Set after REVEAL_DELAY — when all other players' clients show the card. */
    revealedToAllAt: string | null;
    /** Set by the drawing player if they choose to share a hidden description. */
    descriptionShared: boolean;
    resolved: boolean;
}

export interface CardTransfer {
    id: string;
    fromPlayerId: string;
    toPlayerId: string;
    drawEventId: string;
    status: "pending" | "accepted" | "rejected";
    createdAt: string;
}

// ─── API result envelope ─────────────────────────────────────────────────────

export type ApiSuccess<T> = {
    ok: true;
    data: T;
    serverTimestamp: string;
};

export type ApiFailure = {
    ok: false;
    error: { code: string; message: string; details?: unknown };
    serverTimestamp: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

// ─── Request / response shapes ───────────────────────────────────────────────

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    displayName: string;
    invitationCode: string;
}

export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export interface GuestJoinRequest {
    sessionId: string;
    displayName: string;
}

export interface GuestJoinResponse {
    player: Player;
    accessToken: string;
}

export interface CreateSessionRequest {
    name: string;
    filterSettings: FilterSettings;
}

export interface JoinByCodeRequest {
    joinCode: string;
    displayName: string;
}

export interface JoinByCodeResponse {
    session: Session;
    player: Player;
    /** Guest access token, valid for the duration of this session only. */
    accessToken: string;
}

export interface SessionState {
    session: Session;
    players: Player[];
    drawEvents: DrawEvent[];
    pendingTransfers: CardTransfer[];
    serverTimestamp: string;
}

export interface SubmitCardRequest {
    title: string;
    description: string;
    hiddenDescription: boolean;
    imageUrl?: string;
    isDrinking: boolean;
    isFamilySafe: boolean;
    gameTags: string[];
}

// ─── ApiClient interface ─────────────────────────────────────────────────────

export interface ApiClient {
    // ── Auth ────────────────────────────────────────────────────────────────
    login(req: LoginRequest): Promise<ApiResult<AuthResponse>>;
    register(req: RegisterRequest): Promise<ApiResult<AuthResponse>>;
    logout(): Promise<ApiResult<void>>;
    refreshTokens(refreshToken: string): Promise<ApiResult<Pick<AuthResponse, "accessToken" | "refreshToken">>>;

    /**
     * Called when a guest player wants to log in or register mid-session.
     * Requires an active guest access token; merges the guest player into the real account.
     */
    claimAccount(
        guestAccessToken: string,
        credentials: LoginRequest | RegisterRequest,
    ): Promise<ApiResult<AuthResponse>>;

    // ── Sessions ─────────────────────────────────────────────────────────────
    createSession(req: CreateSessionRequest): Promise<ApiResult<Session>>;
    joinByCode(req: JoinByCodeRequest): Promise<ApiResult<JoinByCodeResponse>>;
    getSessionState(sessionId: string, since?: string): Promise<ApiResult<SessionState>>;
    updateSessionFilters(sessionId: string, filterSettings: FilterSettings): Promise<ApiResult<Session>>;
    endSession(sessionId: string): Promise<ApiResult<void>>;
    leaveSession(sessionId: string, playerId: string): Promise<ApiResult<void>>;

    // ── Cards ────────────────────────────────────────────────────────────────
    drawCard(sessionId: string, playerId: string): Promise<ApiResult<DrawEvent>>;
    submitCard(sessionId: string, req: SubmitCardRequest): Promise<ApiResult<Card>>;
    voteCard(cardId: string, direction: "up" | "down"): Promise<ApiResult<void>>;
    flagCard(cardId: string): Promise<ApiResult<void>>;
    shareDescription(drawEventId: string): Promise<ApiResult<DrawEvent>>;
    resolveCard(drawEventId: string): Promise<ApiResult<DrawEvent>>;

    // ── Transfers ────────────────────────────────────────────────────────────
    createTransfer(drawEventId: string, toPlayerId: string): Promise<ApiResult<CardTransfer>>;
    respondToTransfer(
        transferId: string,
        status: "accepted" | "rejected",
    ): Promise<ApiResult<CardTransfer>>;
}
