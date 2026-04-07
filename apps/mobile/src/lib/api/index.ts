import { ApiClient } from "./client";

export type { ApiResult, ApiSuccess, ApiFailure } from "./types";
export type {
    User,
    Player,
    Session,
    FilterSettings,
    Card,
    CardVersion,
    DrawEvent,
    CardTransfer,
    SessionState,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    CreateSessionRequest,
    JoinByCodeRequest,
    JoinByCodeResponse,
    SubmitCardRequest,
} from "./types";
export { SubmitCardRequestSchema } from "./types";

export const apiClient = new ApiClient();

export function setApiAccessToken(token: string | null) {
    apiClient.setAccessToken(token);
}

export function setApiRefreshToken(token: string | null) {
    apiClient.setRefreshToken(token);
}

export function clearApiTokens() {
    apiClient.clearTokens();
}

export function markApiAuthReady() {
    apiClient.markAuthReady();
}

export function setApiCallbacks(callbacks: {
    onTokenRefreshed?: (accessToken: string, refreshToken: string) => Promise<void>;
    onAuthFailed?: () => void;
}) {
    apiClient.setCallbacks(callbacks);
}
