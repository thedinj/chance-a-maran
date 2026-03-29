import { createContext, useContext } from "react";
import type { ApiResult, AuthResponse, Player, User } from "../lib/api";

export interface AuthState {
    /** Logged-in registered user, or null if unauthenticated or guest-only. */
    user: User | null;
    /** True when holding a guest JWT for an active session. */
    isGuest: boolean;
    accessToken: string | null;
    /** True during initial storage hydration — don't render auth-dependent UI until false. */
    isInitializing: boolean;
}

export interface AuthContextValue extends AuthState {
    login(email: string, password: string): Promise<ApiResult<AuthResponse>>;
    register(
        email: string,
        password: string,
        displayName: string,
        invitationCode: string
    ): Promise<ApiResult<AuthResponse>>;
    logout(): Promise<void>;
    /** Called after successfully joining a session as a guest. */
    setGuestSession(token: string, player: Player): void;
    /** Clears the guest JWT — called when session ends or app restarts. */
    clearGuestSession(): void;
    /** Called after in-session account claiming succeeds — upgrades guest to registered. */
    upgradeFromGuest(response: AuthResponse): void;
    /** Called after a successful updateUser API call to sync the new User into state. */
    updateCurrentUser(user: User): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
