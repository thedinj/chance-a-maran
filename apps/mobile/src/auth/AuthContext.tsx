import React, { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import type { ApiResult, AuthResponse, Player, User } from "../lib/api";
import {
    apiClient,
    setApiAccessToken,
    setApiRefreshToken,
    clearApiTokens,
    markApiAuthReady,
    setApiCallbacks,
} from "../lib/api";
import { secureStorage, SECURE_KEYS } from "../lib/secureStorage";
import { queryClient } from "../lib/queryClient";
import { ACTIVE_SESSIONS_KEY, SESSION_HISTORY_KEY } from "../hooks/useSessionQueries";
import { AuthContext, type AuthState } from "./useAuth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isGuest: false,
        accessToken: null,
        isInitializing: true,
    });

    useEffect(() => {
        let cancelled = false;

        async function hydrate() {
            try {
                // Wire callbacks first so they're in place before any refresh attempt
                setApiCallbacks({
                    onTokenRefreshed: async (newAccess, newRefresh) => {
                        setApiAccessToken(newAccess);
                        setState((prev) => ({ ...prev, accessToken: newAccess }));
                        if (Capacitor.isNativePlatform()) {
                            setApiRefreshToken(newRefresh);
                            await secureStorage.set(SECURE_KEYS.REFRESH_TOKEN, newRefresh);
                        }
                    },
                    onAuthFailed: () => {
                        clearApiTokens();
                        if (Capacitor.isNativePlatform()) {
                            secureStorage.remove(SECURE_KEYS.REFRESH_TOKEN);
                        }
                        queryClient.removeQueries({ queryKey: ACTIVE_SESSIONS_KEY });
                        queryClient.removeQueries({ queryKey: SESSION_HISTORY_KEY });
                        setState({
                            user: null,
                            isGuest: false,
                            accessToken: null,
                            isInitializing: false,
                        });
                    },
                });

                // Native: load the persisted refresh token so the silent-refresh request
                // can include it in the body (web sends the HttpOnly cookie automatically).
                if (Capacitor.isNativePlatform()) {
                    const stored = await secureStorage.get(SECURE_KEYS.REFRESH_TOKEN);
                    if (stored) setApiRefreshToken(stored);
                }

                // Silent refresh: browser sends cookie (web) or body token (native).
                // refreshTokens() deduplicates concurrent calls so React Strict Mode's
                // double-invoke only sends one request to the backend.
                const result = await apiClient.refreshTokens();

                if (cancelled) return;

                if (result.ok) {
                    setApiAccessToken(result.data.accessToken);
                    if (Capacitor.isNativePlatform()) {
                        setApiRefreshToken(result.data.refreshToken);
                        await secureStorage.set(SECURE_KEYS.REFRESH_TOKEN, result.data.refreshToken);
                    }
                    markApiAuthReady();

                    const me = await apiClient.getMe();
                    if (cancelled) return;
                    setState({
                        user: me.ok ? me.data : null,
                        isGuest: false,
                        accessToken: result.data.accessToken,
                        isInitializing: false,
                    });
                } else {
                    if (Capacitor.isNativePlatform()) {
                        await secureStorage.remove(SECURE_KEYS.REFRESH_TOKEN);
                    }
                    markApiAuthReady();
                    setState({ user: null, isGuest: false, accessToken: null, isInitializing: false });
                }
            } catch {
                if (cancelled) return;
                markApiAuthReady();
                setState({ user: null, isGuest: false, accessToken: null, isInitializing: false });
            }
        }
        hydrate();
        return () => { cancelled = true; };
    }, []);

    const applyAuthResponse = useCallback((response: AuthResponse) => {
        setApiAccessToken(response.accessToken);
        setState({
            user: response.user,
            isGuest: false,
            accessToken: response.accessToken,
            isInitializing: false,
        });
        if (Capacitor.isNativePlatform()) {
            setApiRefreshToken(response.refreshToken);
            // fire-and-forget — failure here doesn't break the session
            secureStorage.set(SECURE_KEYS.REFRESH_TOKEN, response.refreshToken).catch(() => {});
        }
        // Web: HttpOnly cookie was already set by the server response
        // Invalidate so the session lists refetch for the newly signed-in user.
        queryClient.invalidateQueries({ queryKey: ACTIVE_SESSIONS_KEY });
        queryClient.invalidateQueries({ queryKey: SESSION_HISTORY_KEY });
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
        // Server clears the HttpOnly cookie; we clear local state
        await apiClient.logout();
        clearApiTokens();
        if (Capacitor.isNativePlatform()) {
            await secureStorage.remove(SECURE_KEYS.REFRESH_TOKEN);
        }
        // Remove cached session data — it belongs to the signed-out user and must
        // not be visible if a different user signs in on the same device.
        queryClient.removeQueries({ queryKey: ACTIVE_SESSIONS_KEY });
        queryClient.removeQueries({ queryKey: SESSION_HISTORY_KEY });
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
