import { FakeApiClient } from "./fake";
import { RealApiClient } from "./real";
import type { ApiClient } from "./types";

export type { ApiClient, ApiResult, ApiSuccess, ApiFailure } from "./types";
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

const useFake = import.meta.env.VITE_USE_FAKE_API === "true";

export const apiClient: ApiClient = useFake ? new FakeApiClient() : new RealApiClient();

function realClient(): RealApiClient | null {
    return useFake ? null : (apiClient as RealApiClient);
}

export function setApiAccessToken(token: string | null) {
    realClient()?.setAccessToken(token);
}

export function setApiRefreshToken(token: string | null) {
    realClient()?.setRefreshToken(token);
}

export function clearApiTokens() {
    realClient()?.clearTokens();
}

export function markApiAuthReady() {
    realClient()?.markAuthReady();
}

export function setApiCallbacks(callbacks: {
    onTokenRefreshed?: (accessToken: string, refreshToken: string) => Promise<void>;
    onAuthFailed?: () => void;
}) {
    realClient()?.setCallbacks(callbacks);
}
