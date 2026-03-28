import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ApiResult, AuthResponse, Player, User } from "../lib/api";
import { apiClient, setApiAccessToken } from "../lib/api";

interface AuthState {
    /** Logged-in registered user, or null if unauthenticated or guest-only. */
    user: User | null;
    /** True when holding a guest JWT for an active session. */
    isGuest: boolean;
    accessToken: string | null;
    /** True during initial storage hydration — don't render auth-dependent UI until false. */
    isInitializing: boolean;
}

interface AuthContextValue extends AuthState {
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isGuest: false,
        accessToken: null,
        isInitializing: true,
    });

    // Hydrate from storage on mount
    useEffect(() => {
        async function hydrate() {
            try {
                // TODO: read from Capacitor Secure Storage in production
                // For now, nothing is persisted between sessions
                setState((prev) => ({ ...prev, isInitializing: false }));
            } catch {
                setState((prev) => ({ ...prev, isInitializing: false }));
            }
        }
        hydrate();
    }, []);

    const applyAuthResponse = useCallback((response: AuthResponse) => {
        setApiAccessToken(response.accessToken);
        setState({
            user: response.user,
            isGuest: false,
            accessToken: response.accessToken,
            isInitializing: false,
        });
        // TODO: persist tokens to Capacitor Secure Storage
    }, []);

    const login = useCallback(
        async (email: string, password: string): Promise<ApiResult<AuthResponse>> => {
            const result = await apiClient.login({ email, password });
            if (result.ok) applyAuthResponse(result.data);
            return result;
        },
        [applyAuthResponse]
    );

    const register = useCallback(
        async (
            email: string,
            password: string,
            displayName: string,
            invitationCode: string
        ): Promise<ApiResult<AuthResponse>> => {
            const result = await apiClient.register({
                email,
                password,
                displayName,
                invitationCode,
            });
            if (result.ok) applyAuthResponse(result.data);
            return result;
        },
        [applyAuthResponse]
    );

    const logout = useCallback(async () => {
        await apiClient.logout();
        setApiAccessToken(null);
        // TODO: clear Capacitor Secure Storage
        setState({ user: null, isGuest: false, accessToken: null, isInitializing: false });
    }, []);

    const setGuestSession = useCallback((token: string, _player: Player) => {
        setApiAccessToken(token);
        setState((prev) => ({
            ...prev,
            isGuest: true,
            accessToken: token,
            // Guest JWTs never set `user` — guest identity lives in SessionContext
        }));
    }, []);

    const clearGuestSession = useCallback(() => {
        setApiAccessToken(null);
        setState((prev) => ({ ...prev, isGuest: false, accessToken: null }));
    }, []);

    const upgradeFromGuest = useCallback(
        (response: AuthResponse) => {
            applyAuthResponse(response);
        },
        [applyAuthResponse]
    );

    return (
        <AuthContext.Provider
            value={{
                ...state,
                login,
                register,
                logout,
                setGuestSession,
                clearGuestSession,
                upgradeFromGuest,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
