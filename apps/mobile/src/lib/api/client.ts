import type {
    ApiResult,
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
    ImageUploadResponse,
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

const REQUEST_TIMEOUT_MS = 15_000;

function resolveBaseUrl(): string {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
    if (import.meta.env.DEV) return "http://localhost:3000";
    return "https://api.chance.app";
}

export class ApiClient {
    private baseUrl = resolveBaseUrl();
    private accessToken: string | null = null;
    // Native only: the raw refresh token loaded from secure storage.
    // Web: always null — the HttpOnly cookie is the refresh mechanism.
    private refreshToken: string | null = null;

    private isRefreshing = false;
    private refreshPromise: Promise<boolean> | null = null;

    // Resolved once AuthContext finishes the hydration/silent-refresh attempt.
    // Non-auth requests wait on this gate so they don't race the hydration.
    private authReadyResolve!: () => void;
    private authReadyPromise: Promise<void> = new Promise((resolve) => {
        this.authReadyResolve = resolve;
    });

    // Wired by AuthContext after mount so token state changes are reflected there.
    onTokenRefreshed?: (accessToken: string, refreshToken: string) => Promise<void>;
    onAuthFailed?: () => void;

    // ── Control surface (called by index.ts helpers) ──────────────────────────

    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    setRefreshToken(token: string | null) {
        this.refreshToken = token;
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
    }

    markAuthReady() {
        this.authReadyResolve();
    }

    setCallbacks(callbacks: {
        onTokenRefreshed?: (accessToken: string, refreshToken: string) => Promise<void>;
        onAuthFailed?: () => void;
    }) {
        this.onTokenRefreshed = callbacks.onTokenRefreshed;
        this.onAuthFailed = callbacks.onAuthFailed;
    }

    // ── Core request ──────────────────────────────────────────────────────────

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
        isRetry = false
    ): Promise<ApiResult<T>> {
        // Non-auth routes wait until the hydration/silent-refresh attempt is done
        // so they don't fire before the access token is restored.
        // /api/config is auth-free and needed before AuthContext mounts — skip the gate.
        if (!path.startsWith("/api/auth/") && path !== "/api/config") {
            await this.authReadyPromise;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        // FormData: let the browser set Content-Type (includes the multipart boundary).
        // Everything else: JSON.
        const isFormData = body instanceof FormData;

        let res: Response;
        try {
            res = await fetch(`${this.baseUrl}${path}`, {
                method,
                signal: controller.signal,
                credentials: "include", // always send HttpOnly cookie cross-origin (web)
                headers: {
                    ...(isFormData ? {} : { "Content-Type": "application/json" }),
                    ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
                },
                body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
            });
        } catch (err) {
            clearTimeout(timeout);
            return {
                ok: false,
                error: {
                    code: "NETWORK_ERROR",
                    message:
                        err instanceof Error && err.name === "AbortError"
                            ? "Request timed out."
                            : "A network error occurred.",
                },
                serverTimestamp: new Date().toISOString(),
            };
        } finally {
            clearTimeout(timeout);
        }

        // Auto-refresh on 401 with X-Token-Status: invalid (once per request)
        if (res.status === 401 && res.headers.get("X-Token-Status") === "invalid" && !isRetry) {
            const refreshed = await this.tryRefreshToken();
            if (refreshed) {
                return this.request<T>(method, path, body, true);
            }
            // Refresh failed — return the original 401
        }

        try {
            return (await res.json()) as ApiResult<T>;
        } catch {
            return {
                ok: false,
                error: { code: "NETWORK_ERROR", message: "Invalid response from server." },
                serverTimestamp: new Date().toISOString(),
            };
        }
    }

    private async tryRefreshToken(): Promise<boolean> {
        // Deduplicate concurrent refresh attempts
        if (this.isRefreshing) {
            return this.refreshPromise!;
        }
        this.isRefreshing = true;
        this.refreshPromise = (async () => {
            try {
                const result = await this.request<
                    Pick<AuthResponse, "accessToken" | "refreshToken">
                >(
                    "POST",
                    "/api/auth/refresh",
                    this.refreshToken ? { refreshToken: this.refreshToken } : undefined,
                    true // isRetry — prevents loop
                );
                if (result.ok) {
                    this.accessToken = result.data.accessToken;
                    this.refreshToken = result.data.refreshToken;
                    await this.onTokenRefreshed?.(
                        result.data.accessToken,
                        result.data.refreshToken
                    );
                    return true;
                }
                this.clearTokens();
                this.onAuthFailed?.();
                return false;
            } catch {
                this.clearTokens();
                this.onAuthFailed?.();
                return false;
            } finally {
                this.isRefreshing = false;
                this.refreshPromise = null;
            }
        })();
        return this.refreshPromise;
    }

    // ── App config ────────────────────────────────────────────────────────────

    getAppConfig() {
        return this.request<AppConfig>("GET", "/api/config");
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    login(req: LoginRequest) {
        return this.request<AuthResponse>("POST", "/api/auth/login", req);
    }

    register(req: RegisterRequest) {
        return this.request<AuthResponse>("POST", "/api/auth/register", req);
    }

    logout() {
        return this.request<void>("POST", "/api/auth/logout");
    }

    refreshTokens(refreshToken?: string) {
        return this.request<Pick<AuthResponse, "accessToken" | "refreshToken">>(
            "POST",
            "/api/auth/refresh",
            refreshToken ? { refreshToken } : undefined
        );
    }

    claimAccount(guestAccessToken: string, credentials: LoginRequest | RegisterRequest) {
        return this.request<AuthResponse>("POST", "/api/auth/claim", {
            guestAccessToken,
            ...credentials,
        });
    }

    getMe() {
        return this.request<User>("GET", "/api/auth/me");
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    createSession(req: CreateSessionRequest) {
        return this.request<Session>("POST", "/api/sessions", req);
    }

    joinByCode(req: JoinByCodeRequest) {
        return this.request<JoinByCodeResponse>("POST", "/api/sessions/join", req);
    }

    getSessionState(sessionId: string, since?: string) {
        const query = since ? `?since=${encodeURIComponent(since)}` : "";
        return this.request<SessionState>("GET", `/api/sessions/${sessionId}/state${query}`);
    }

    getSessionHistory() {
        return this.request<SessionSummary[]>("GET", "/api/sessions/history");
    }

    getActiveSessions() {
        return this.request<SessionSummary[]>("GET", "/api/sessions/active");
    }

    updateSessionSettings(sessionId: string, opts: { filterSettings: FilterSettings; name?: string }) {
        return this.request<Session>("PATCH", `/api/sessions/${sessionId}/filters`, {
            filterSettings: opts.filterSettings,
            ...(opts.name !== undefined ? { name: opts.name } : {}),
        });
    }

    endSession(sessionId: string) {
        return this.request<void>("POST", `/api/sessions/${sessionId}/end`);
    }

    leaveSession(sessionId: string, playerId: string) {
        return this.request<void>("POST", `/api/sessions/${sessionId}/leave`, { playerId });
    }

    // ── Cards ─────────────────────────────────────────────────────────────────

    drawCard(sessionId: string, playerId: string) {
        return this.request<DrawEvent>("POST", `/api/sessions/${sessionId}/draw`, { playerId });
    }

    drawReparationsCard(sessionId: string, playerId: string) {
        return this.request<DrawEvent>("POST", `/api/sessions/${sessionId}/draw-reparations`, {
            playerId,
        });
    }

    submitCard(sessionId: string, req: SubmitCardRequest) {
        return this.request<Card>("POST", `/api/sessions/${sessionId}/cards`, req);
    }

    submitCardOutsideSession(req: SubmitCardRequest) {
        return this.request<Card>("POST", "/api/cards", req);
    }

    voteCard(cardId: string, direction: "up" | "down") {
        return this.request<void>("POST", `/api/cards/${cardId}/vote`, { direction });
    }

    clearVote(cardId: string) {
        return this.request<void>("DELETE", `/api/cards/${cardId}/vote`);
    }

    shareDescription(drawEventId: string) {
        return this.request<DrawEvent>("POST", `/api/draw-events/${drawEventId}/share-description`);
    }

    resolveCard(drawEventId: string, resolved: boolean) {
        return this.request<DrawEvent>("PATCH", `/api/draw-events/${drawEventId}`, { resolved });
    }

    // ── Transfers ─────────────────────────────────────────────────────────────

    createTransfer(drawEventId: string, fromPlayerId: string, toPlayerId: string) {
        return this.request<CardTransfer>("POST", "/api/transfers", {
            drawEventId,
            fromPlayerId,
            toPlayerId,
        });
    }

    acceptTransfer(transferId: string, acceptingPlayerId: string) {
        return this.request<DrawEvent>("POST", `/api/transfers/${transferId}/accept`, {
            acceptingPlayerId,
        });
    }

    cancelTransfer(transferId: string, requestingPlayerId: string) {
        return this.request<void>("DELETE", `/api/transfers/${transferId}`, {
            requestingPlayerId,
        });
    }

    // ── Player management ─────────────────────────────────────────────────────

    resetPlayerToken(sessionId: string, playerId: string) {
        return this.request<void>("PATCH", `/api/sessions/${sessionId}/players/${playerId}`, {
            resetToken: true,
        });
    }

    updatePlayerSettings(
        sessionId: string,
        playerId: string,
        patch: { displayName?: string; cardSharing?: "none" | "mine" | "network" }
    ) {
        return this.request<Player>(
            "PATCH",
            `/api/sessions/${sessionId}/players/${playerId}`,
            patch
        );
    }

    // ── User management ───────────────────────────────────────────────────────

    updateUser(req: UpdateUserRequest) {
        return this.request<User>("PATCH", "/api/users/me", req);
    }

    changePassword(req: ChangePasswordRequest) {
        return this.request<void>("POST", "/api/users/me/change-password", req);
    }

    // ── Images ────────────────────────────────────────────────────────────────

    uploadImage(file: File) {
        const form = new FormData();
        form.append("file", file);
        return this.request<ImageUploadResponse>("POST", "/api/images", form);
    }

    deleteImage(imageId: string) {
        return this.request<void>("DELETE", `/api/images/${imageId}`);
    }

    /**
     * Constructs a fully-qualified display URL from a stored imageId UUID.
     * Returns null for null input.
     */
    resolveImageUrl(imageId: string | null): string | null {
        if (!imageId) return null;
        return `${this.baseUrl}/api/images/${imageId}`;
    }

    // ── Games ─────────────────────────────────────────────────────────────────

    getGames() {
        return this.request<Game[]>("GET", "/api/games");
    }

    // ── My Cards management ───────────────────────────────────────────────────

    getMyCards() {
        return this.request<Card[]>("GET", "/api/cards/mine");
    }

    getAllCards(filters?: GetAllCardsFilters) {
        const params = new URLSearchParams();
        if (filters?.search) params.set("search", filters.search);
        if (filters?.active !== undefined) params.set("active", String(filters.active));
        if (filters?.isGlobal !== undefined) params.set("isGlobal", String(filters.isGlobal));
        const query = params.size ? `?${params}` : "";
        return this.request<Card[]>("GET", `/api/cards${query}`);
    }

    updateCard(cardId: string, req: SubmitCardRequest) {
        return this.request<Card>("PATCH", `/api/cards/${cardId}`, req);
    }

    deactivateCard(cardId: string) {
        return this.request<Card>("PATCH", `/api/cards/${cardId}/deactivate`);
    }

    reactivateCard(cardId: string) {
        return this.request<Card>("PATCH", `/api/cards/${cardId}/reactivate`);
    }

    getCardVersions(cardId: string) {
        return this.request<CardVersion[]>("GET", `/api/cards/${cardId}/versions`);
    }

    promoteToGlobal(cardId: string) {
        return this.request<Card>("POST", `/api/cards/${cardId}/promote`);
    }

    demoteFromGlobal(cardId: string) {
        return this.request<Card>("POST", `/api/cards/${cardId}/demote`);
    }
}
