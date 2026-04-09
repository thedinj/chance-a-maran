"use client";

import type { ApiResult, AuthResponse, User } from "@chance/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminSessionContext } from "./AdminSessionContext";
import { parseApiResult } from "./useAdminFetch";

interface AdminSessionProviderProps {
    children: React.ReactNode;
}

const STORAGE_ACCESS_TOKEN_KEY = "admin_access_token";
const STORAGE_REFRESH_TOKEN_KEY = "admin_refresh_token";
const STORAGE_USER_KEY = "admin_user";

const AdminSessionProvider: React.FC<AdminSessionProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Guard against concurrent refresh calls (e.g. multiple 401s in parallel)
    const refreshInFlight = useRef<Promise<boolean> | null>(null);

    // Persist tokens to localStorage (shared across tabs)
    const persistSession = useCallback((accessToken: string, refreshToken: string, user: User) => {
        localStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(STORAGE_REFRESH_TOKEN_KEY, refreshToken);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        setAccessToken(accessToken);
        setRefreshToken(refreshToken);
        setUser(user);
    }, []);

    // Clear session from storage
    const clearSession = useCallback(() => {
        localStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
        localStorage.removeItem(STORAGE_REFRESH_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
    }, []);

    // Refresh access token using refresh token (deduplicated)
    const refreshAccessToken = useCallback(
        async (currentRefreshToken: string): Promise<boolean> => {
            // If a refresh is already in progress, wait for it instead of firing another
            if (refreshInFlight.current) return refreshInFlight.current;

            const attempt = (async () => {
                try {
                    const response = await fetch("/api/auth/refresh", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Token-Transport": "body",
                        },
                        body: JSON.stringify({ refreshToken: currentRefreshToken }),
                    });

                    const envelope = (await response.json()) as ApiResult<
                        Pick<AuthResponse, "accessToken" | "refreshToken">
                    >;
                    if (!envelope.ok) return false;

                    const storedUserRaw = localStorage.getItem(STORAGE_USER_KEY);
                    if (!storedUserRaw) return false;
                    const storedUser: User = JSON.parse(storedUserRaw) as User;
                    if (!storedUser.isAdmin) return false;

                    persistSession(
                        envelope.data.accessToken,
                        envelope.data.refreshToken,
                        storedUser
                    );
                    return true;
                } catch {
                    return false;
                } finally {
                    refreshInFlight.current = null;
                }
            })();

            refreshInFlight.current = attempt;
            return attempt;
        },
        [persistSession]
    );

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const storedRefreshToken = localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);

                if (storedRefreshToken) {
                    const success = await refreshAccessToken(storedRefreshToken);
                    if (success) {
                        setIsLoading(false);
                        return;
                    }
                }

                clearSession();
            } catch {
                clearSession();
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();
    }, [refreshAccessToken, clearSession]);

    const login = useCallback(
        async (email: string, password: string) => {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Token-Transport": "body",
                },
                body: JSON.stringify({ email, password }),
            });

            const { user, accessToken, refreshToken } = await parseApiResult<AuthResponse>(response);

            if (!user.isAdmin) {
                throw new Error("Access denied: admin privileges required");
            }

            persistSession(accessToken, refreshToken, user);
        },
        [persistSession]
    );

    const logout = useCallback(async () => {
        try {
            const token = refreshToken ?? localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);
            if (token) {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Token-Transport": "body",
                        "Authorization": `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ refreshToken: token }),
                });
            }
        } catch {
            // Best-effort server revocation; clear locally regardless
        } finally {
            clearSession();
        }
    }, [accessToken, refreshToken, clearSession]);

    const tryRefreshToken = useCallback(async (): Promise<boolean> => {
        const token = refreshToken ?? localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);
        if (!token) return false;
        return await refreshAccessToken(token);
    }, [refreshToken, refreshAccessToken]);

    const value = useMemo(
        () => ({
            user,
            accessToken,
            refreshToken,
            isLoading,
            login,
            logout,
            tryRefreshToken,
        }),
        [user, accessToken, refreshToken, isLoading, login, logout, tryRefreshToken]
    );

    return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
};

export default AdminSessionProvider;
