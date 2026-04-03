// Domain types and API contract types live in @chance/core.
// This file re-exports them for backwards compatibility and defines
// the mobile-specific ApiClient interface.

export type {
    // Domain entities
    User,
    Player,
    FilterSettings,
    Session,
    CardVersion,
    Card,
    DrawEvent,
    CardTransfer,
    Game,
    // API envelope
    ApiSuccess,
    ApiFailure,
    ApiResult,
    // Auth
    LoginRequest,
    RegisterRequest,
    AuthResponse,
    // Sessions
    GuestJoinRequest,
    GuestJoinResponse,
    CreateSessionRequest,
    JoinByCodeRequest,
    JoinByCodeResponse,
    SessionState,
    // Cards
    SubmitCardRequest,
    // User management
    UpdateUserRequest,
    ChangePasswordRequest,
} from "@chance/core";

import type {
    User,
    Player,
    FilterSettings,
    Session,
    Card,
    CardVersion,
    DrawEvent,
    CardTransfer,
    Game,
    ApiResult,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    CreateSessionRequest,
    JoinByCodeRequest,
    JoinByCodeResponse,
    SessionState,
    SubmitCardRequest,
    UpdateUserRequest,
    ChangePasswordRequest,
} from "@chance/core";

// ─── Local types ─────────────────────────────────────────────────────────────

export interface AppConfig {
    inviteCodeRequired: boolean;
}

export interface GetAllCardsFilters {
    search?: string;
    active?: boolean;
    isGlobal?: boolean;
}

// ─── ApiClient interface ─────────────────────────────────────────────────────

export interface ApiClient {
    // ── App config ───────────────────────────────────────────────────────────
    /** Public endpoint — no auth required. Returns server-side app configuration. */
    getAppConfig(): Promise<ApiResult<AppConfig>>;

    // ── Auth ────────────────────────────────────────────────────────────────
    login(req: LoginRequest): Promise<ApiResult<AuthResponse>>;
    register(req: RegisterRequest): Promise<ApiResult<AuthResponse>>;
    logout(): Promise<ApiResult<void>>;
    /** Web: no argument needed (HttpOnly cookie sent automatically). Native: pass stored refresh token. */
    refreshTokens(
        refreshToken?: string
    ): Promise<ApiResult<Pick<AuthResponse, "accessToken" | "refreshToken">>>;
    getMe(): Promise<ApiResult<User>>;

    /**
     * Called when a guest player wants to log in or register mid-session.
     * Requires an active guest access token; merges the guest player into the real account.
     */
    claimAccount(
        guestAccessToken: string,
        credentials: LoginRequest | RegisterRequest
    ): Promise<ApiResult<AuthResponse>>;

    // ── Sessions ─────────────────────────────────────────────────────────────
    createSession(req: CreateSessionRequest): Promise<ApiResult<Session>>;
    joinByCode(req: JoinByCodeRequest): Promise<ApiResult<JoinByCodeResponse>>;
    getSessionState(sessionId: string, since?: string): Promise<ApiResult<SessionState>>;
    updateSessionFilters(
        sessionId: string,
        filterSettings: FilterSettings
    ): Promise<ApiResult<Session>>;
    endSession(sessionId: string): Promise<ApiResult<void>>;
    leaveSession(sessionId: string, playerId: string): Promise<ApiResult<void>>;

    // ── Cards ────────────────────────────────────────────────────────────────
    drawCard(sessionId: string, playerId: string): Promise<ApiResult<DrawEvent>>;
    /** Draw a reparations card (penalty pool) for a player. */
    drawReparationsCard(sessionId: string, playerId: string): Promise<ApiResult<DrawEvent>>;
    submitCard(sessionId: string, req: SubmitCardRequest): Promise<ApiResult<Card>>;
    submitCardOutsideSession(req: SubmitCardRequest): Promise<ApiResult<Card>>;
    voteCard(cardId: string, direction: "up" | "down"): Promise<ApiResult<void>>;
    /** Removes the current user's vote on a card. No-op if no vote exists. */
    clearVote(cardId: string): Promise<ApiResult<void>>;
    shareDescription(drawEventId: string): Promise<ApiResult<DrawEvent>>;
    /** Sets resolved state on a draw event. Any player in the session may call this. */
    resolveCard(drawEventId: string, resolved: boolean): Promise<ApiResult<DrawEvent>>;

    // ── Games ────────────────────────────────────────────────────────────────
    /** Public — no auth required. Returns all active games for the game tag picker. */
    getGames(): Promise<ApiResult<Game[]>>;

    // ── My Cards management ───────────────────────────────────────────────────
    /** Returns all cards authored by the current user. */
    getMyCards(): Promise<ApiResult<Card[]>>;
    /** Admin only — returns the full card pool with optional filters. */
    getAllCards(filters?: GetAllCardsFilters): Promise<ApiResult<Card[]>>;
    /** Creates a new CardVersion for the card. Returns the updated Card. */
    updateCard(cardId: string, req: SubmitCardRequest): Promise<ApiResult<Card>>;
    /** Sets card.active = false. Owner or admin. Returns the updated Card. */
    deactivateCard(cardId: string): Promise<ApiResult<Card>>;
    /** Sets card.active = true. Owner or admin. Returns the updated Card. */
    reactivateCard(cardId: string): Promise<ApiResult<Card>>;
    /** Returns all versions for a card, oldest first. */
    getCardVersions(cardId: string): Promise<ApiResult<CardVersion[]>>;
    /** Admin only — sets card.isGlobal = true. Returns the updated Card. */
    promoteToGlobal(cardId: string): Promise<ApiResult<Card>>;
    /** Admin only — sets card.isGlobal = false. Returns the updated Card. */
    demoteFromGlobal(cardId: string): Promise<ApiResult<Card>>;

    // ── Transfers ────────────────────────────────────────────────────────────
    createTransfer(
        drawEventId: string,
        fromPlayerId: string,
        toPlayerId: string
    ): Promise<ApiResult<CardTransfer>>;
    /** Accept a pending transfer — deletes the record and returns the new DrawEvent for the recipient. */
    acceptTransfer(transferId: string, acceptingPlayerId: string): Promise<ApiResult<DrawEvent>>;
    /** Cancel a pending transfer (retract by offerer or decline by recipient) — deletes the record. */
    cancelTransfer(transferId: string, requestingPlayerId: string): Promise<ApiResult<void>>;

    // ── Player management ────────────────────────────────────────────────────
    /**
     * Host-only: nulls session_players.player_token for a guest player.
     * The original device's JWT becomes invalid on its next request (401).
     * The name is freed for any device to claim.
     * Rejected if the target player has a linked account (userId is set).
     */
    resetPlayerToken(sessionId: string, playerId: string): Promise<ApiResult<void>>;

    /**
     * Non-host player settings update. Patch object grows as new per-player
     * settings are introduced. cardSharing is only valid for registered players.
     */
    updatePlayerSettings(
        sessionId: string,
        playerId: string,
        patch: { displayName?: string; cardSharing?: "none" | "mine" | "network" }
    ): Promise<ApiResult<Player>>;

    // ── User management ──────────────────────────────────────────────────────
    /** Update the current user's display name and/or email. Returns the updated User. */
    updateUser(req: UpdateUserRequest): Promise<ApiResult<User>>;
    /** Change the current user's password. Requires the current password for verification. */
    changePassword(req: ChangePasswordRequest): Promise<ApiResult<void>>;
}
