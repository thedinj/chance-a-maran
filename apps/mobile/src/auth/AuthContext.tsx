import React, { useCallback, useEffect, useState } from "react";
import type { AuthResponse, Player } from "../lib/api";
import { apiClient, setApiAccessToken } from "../lib/api";
import { AuthContext, type AuthState } from "./useAuth";

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
            // Only valid when no registered user exists on the device (auth.user === null).
            // Calling this while a registered user is already present is a logic error —
            // the single-registered-user-per-device constraint must be enforced at the call site.
            applyAuthResponse(response);
        },
        [applyAuthResponse]
    );

    const updateCurrentUser = useCallback((user: User) => {
        setState((prev) => ({ ...prev, user }));
    }, []);

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
                updateCurrentUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
