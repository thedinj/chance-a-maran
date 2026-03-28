import type {
    ApiClient,
    ApiResult,
    AuthResponse,
    Card,
    CardTransfer,
    CreateSessionRequest,
    DrawEvent,
    FilterSettings,
    JoinByCodeRequest,
    JoinByCodeResponse,
    LoginRequest,
    RegisterRequest,
    Session,
    SessionState,
    SubmitCardRequest,
} from "./types";

const REQUEST_TIMEOUT_MS = 15_000;

function resolveBaseUrl(): string {
    // Vite env → Capacitor Preferences override (set at runtime) → platform defaults
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
    // Android emulator default; will be overridden by Capacitor Preferences in production
    if (import.meta.env.DEV) return "http://10.0.2.2:3000";
    return "https://api.chance.app";
}

export class RealApiClient implements ApiClient {
    private baseUrl = resolveBaseUrl();
    private accessToken: string | null = null;

    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    private async request<T>(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<ApiResult<T>> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const res = await fetch(`${this.baseUrl}${path}`, {
                method,
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });

            const json = (await res.json()) as ApiResult<T>;

            // Token refresh on 401 is handled at the AuthContext level via the
            // X-Token-Status header — not here. ApiClient never throws.
            return json;
        } catch (err) {
            return {
                ok: false,
                error: {
                    code: "NETWORK_ERROR",
                    message: err instanceof Error && err.name === "AbortError"
                        ? "Request timed out."
                        : "A network error occurred.",
                },
                serverTimestamp: new Date().toISOString(),
            };
        } finally {
            clearTimeout(timeout);
        }
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

    refreshTokens(refreshToken: string) {
        return this.request<Pick<AuthResponse, "accessToken" | "refreshToken">>(
            "POST",
            "/api/auth/refresh",
            { refreshToken },
        );
    }

    claimAccount(guestAccessToken: string, credentials: LoginRequest | RegisterRequest) {
        return this.request<AuthResponse>("POST", "/api/auth/claim", {
            guestAccessToken,
            ...credentials,
        });
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

    updateSessionFilters(sessionId: string, filterSettings: FilterSettings) {
        return this.request<Session>("PATCH", `/api/sessions/${sessionId}/filters`, { filterSettings });
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

    submitCard(sessionId: string, req: SubmitCardRequest) {
        return this.request<Card>("POST", `/api/sessions/${sessionId}/cards`, req);
    }

    voteCard(cardId: string, direction: "up" | "down") {
        return this.request<void>("POST", `/api/cards/${cardId}/vote`, { direction });
    }

    flagCard(cardId: string) {
        return this.request<void>("POST", `/api/cards/${cardId}/flag`);
    }

    shareDescription(drawEventId: string) {
        return this.request<DrawEvent>("POST", `/api/draw-events/${drawEventId}/share-description`);
    }

    resolveCard(drawEventId: string) {
        return this.request<DrawEvent>("POST", `/api/draw-events/${drawEventId}/resolve`);
    }

    // ── Transfers ─────────────────────────────────────────────────────────────

    createTransfer(drawEventId: string, toPlayerId: string) {
        return this.request<CardTransfer>("POST", "/api/transfers", { drawEventId, toPlayerId });
    }

    respondToTransfer(transferId: string, status: "accepted" | "rejected") {
        return this.request<CardTransfer>("PATCH", `/api/transfers/${transferId}`, { status });
    }
}
