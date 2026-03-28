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

// Expose the real client's setAccessToken when not in fake mode
export function setApiAccessToken(token: string | null) {
    if (!useFake) {
        (apiClient as RealApiClient).setAccessToken(token);
    }
}
