"use client";

import type { ApiResult, AuthResponse, User } from "@chance/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminSessionContext } from "./AdminSessionContext";
import { parseApiResult } from "./useAdminFetch";
import { authError, authLog, authWarn, tokenExpiry } from "./authDebug";

interface AdminSessionProviderProps {
    children: React.ReactNode;
}

const STORAGE_ACCESS_TOKEN_KEY = "admin_access_token";
const STORAGE_REFRESH_TOKEN_KEY = "admin_refresh_token";
const STORAGE_USER_KEY = "admin_user";

/**
 * Decodes the JWT exp claim client-side (no signature check — server validates that).
 * Returns true if the token is missing, malformed, or expires within the buffer window.
 * Buffer is 90s to match the proactive refresh timer, eliminating the gap where the
 * token looks "valid" but the timer already decided not to proactively refresh.
 */
function isTokenExpired(token: string, bufferMs = 90_000): boolean {
    try {
        const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
        return !payload.exp || Date.now() >= payload.exp * 1000 - bufferMs;
    } catch {
        return true;
    }
}

const AdminSessionProvider: React.FC<AdminSessionProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Guard against concurrent refresh calls (e.g. multiple 401s firing in parallel)
    const refreshInFlight = useRef<Promise<string | null> | null>(null);

    // Persist tokens to localStorage (shared across tabs)
    const persistSession = useCallback((newAccessToken: string, newRefreshToken: string, newUser: User) => {
        localStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, newAccessToken);
        localStorage.setItem(STORAGE_REFRESH_TOKEN_KEY, newRefreshToken);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser));
        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        setUser(newUser);
        authLog("persistSession: new tokens stored", {
            userId: newUser.id,
            isAdmin: newUser.isAdmin,
            accessToken: tokenExpiry(newAccessToken),
        });
    }, []);

    // Clear session from storage
    const clearSession = useCallback(() => {
        authWarn("clearSession: wiping all tokens and user state");
        localStorage.removeItem(STORAGE_ACCESS_TOKEN_KEY);
        localStorage.removeItem(STORAGE_REFRESH_TOKEN_KEY);
        localStorage.removeItem(STORAGE_USER_KEY);
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
    }, []);

    // Refresh access token using refresh token (deduplicated).
    // Returns the new access token on success, or null on failure.
    // Multiple concurrent callers all await the same in-flight promise so they
    // each receive the same fresh token without firing duplicate requests.
    const refreshAccessToken = useCallback(
        async (currentRefreshToken: string): Promise<string | null> => {
            // If a refresh is already in progress, wait for it instead of firing another
            if (refreshInFlight.current) {
                authLog("refreshAccessToken: already in-flight — deduplicating");
                return refreshInFlight.current;
            }

            const attempt = (async (): Promise<string | null> => {
                authLog("refreshAccessToken: sending POST /api/auth/refresh");
                try {
                    const response = await fetch("/api/auth/refresh", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Token-Transport": "body",
                        },
                        body: JSON.stringify({ refreshToken: currentRefreshToken }),
                    });

                    authLog("refreshAccessToken: got response", { status: response.status });

                    const envelope = (await response.json()) as ApiResult<
                        Pick<AuthResponse, "accessToken" | "refreshToken">
                    >;

                    if (!envelope.ok) {
                        const err = envelope as unknown as { error?: { code?: string; message?: string } };
                        authError("refreshAccessToken: server rejected token", {
                            code: err.error?.code,
                            message: err.error?.message,
                        });
                        return null;
                    }

                    const storedUserRaw = localStorage.getItem(STORAGE_USER_KEY);
                    if (!storedUserRaw) {
                        authError("refreshAccessToken: no stored user in localStorage — cannot restore session");
                        return null;
                    }

                    const storedUser: User = JSON.parse(storedUserRaw) as User;
                    if (!storedUser.isAdmin) {
                        authError("refreshAccessToken: stored user is not admin — refusing to restore", {
                            userId: storedUser.id,
                        });
                        return null;
                    }

                    persistSession(envelope.data.accessToken, envelope.data.refreshToken, storedUser);

                    // Return the new token directly so callers can use it immediately.
                    // Do NOT rely on React state or the tokenRef here — neither has updated
                    // yet because React hasn't re-rendered the component.
                    authLog("refreshAccessToken: success", {
                        newAccessToken: tokenExpiry(envelope.data.accessToken),
                    });
                    return envelope.data.accessToken;
                } catch (err) {
                    authError("refreshAccessToken: exception", {
                        error: err instanceof Error ? err.message : String(err),
                    });
                    return null;
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
        let cancelled = false;

        const checkSession = async () => {
            try {
                const storedAccessToken = localStorage.getItem(STORAGE_ACCESS_TOKEN_KEY);
                const storedRefreshToken = localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);
                const storedUserRaw = localStorage.getItem(STORAGE_USER_KEY);

                authLog("checkSession: reading localStorage on mount", {
                    hasAccessToken: !!storedAccessToken,
                    accessTokenStatus: storedAccessToken
                        ? isTokenExpired(storedAccessToken)
                            ? `EXPIRED (${tokenExpiry(storedAccessToken)})`
                            : tokenExpiry(storedAccessToken)
                        : "missing",
                    hasRefreshToken: !!storedRefreshToken,
                    hasStoredUser: !!storedUserRaw,
                });

                // If the access token is still valid, restore state directly without
                // hitting the refresh endpoint. This avoids rotating the refresh token
                // on every page load, which breaks with multiple tabs or React Strict Mode.
                if (storedAccessToken && storedRefreshToken && storedUserRaw && !isTokenExpired(storedAccessToken)) {
                    const storedUser = JSON.parse(storedUserRaw) as User;
                    if (storedUser.isAdmin) {
                        authLog("checkSession: valid access token — restoring session without refresh", {
                            userId: storedUser.id,
                            accessToken: tokenExpiry(storedAccessToken),
                        });
                        if (cancelled) return;
                        setAccessToken(storedAccessToken);
                        setRefreshToken(storedRefreshToken);
                        setUser(storedUser);
                        setIsLoading(false);
                        return;
                    }
                    authWarn("checkSession: stored user lacks admin flag — will not restore", {
                        userId: (JSON.parse(storedUserRaw) as User).id,
                    });
                }

                // Access token missing or expired — exchange the refresh token
                if (storedRefreshToken) {
                    authLog("checkSession: access token expired or missing — attempting refresh with stored refresh token");
                    const newToken = await refreshAccessToken(storedRefreshToken);
                    if (cancelled) return;
                    if (newToken) {
                        authLog("checkSession: session restored via refresh token");
                        setIsLoading(false);
                        return;
                    }
                    authWarn("checkSession: refresh failed — session will be cleared");
                } else {
                    authLog("checkSession: no refresh token in storage — unauthenticated");
                }

                if (cancelled) return;
                clearSession();
            } catch (err) {
                if (cancelled) return;
                authError("checkSession: unexpected error", {
                    error: err instanceof Error ? err.message : String(err),
                });
                clearSession();
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        checkSession();
        return () => { cancelled = true; };
    }, [refreshAccessToken, clearSession]);

    const login = useCallback(
        async (email: string, password: string) => {
            authLog("login: attempting", { email });
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
                authWarn("login: user authenticated but is not admin — rejecting");
                throw new Error("Access denied: admin privileges required");
            }

            authLog("login: success", { userId: user.id, accessToken: tokenExpiry(accessToken) });
            persistSession(accessToken, refreshToken, user);
        },
        [persistSession]
    );

    const logout = useCallback(async () => {
        authLog("logout: revoking refresh token on server");
        try {
            const token = refreshToken ?? localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);
            if (token) {
                await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Token-Transport": "body",
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ refreshToken: token }),
                });
            }
        } catch (err) {
            authWarn("logout: server revocation failed (clearing locally anyway)", {
                error: err instanceof Error ? err.message : String(err),
            });
            // Best-effort server revocation; clear locally regardless
        } finally {
            clearSession();
        }
    }, [accessToken, refreshToken, clearSession]);

    const tryRefreshToken = useCallback(async (): Promise<string | null> => {
        const tokenFromState = refreshToken;
        const tokenFromStorage = localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);
        const token = tokenFromState ?? tokenFromStorage;

        authLog("tryRefreshToken: called", {
            tokenSource: tokenFromState ? "state" : tokenFromStorage ? "localStorage" : "none",
            hasToken: !!token,
        });

        if (!token) {
            authWarn("tryRefreshToken: no refresh token available anywhere — clearing session");
            clearSession();
            return null;
        }

        const newAccessToken = await refreshAccessToken(token);

        if (!newAccessToken) {
            authWarn("tryRefreshToken: refresh returned null — clearing session");
            clearSession();
        } else {
            authLog("tryRefreshToken: success", { newAccessToken: tokenExpiry(newAccessToken) });
        }

        return newAccessToken;
    }, [refreshToken, refreshAccessToken, clearSession]);

    // Proactively refresh the access token 90 seconds before it expires so the
    // admin portal never hits a 401 mid-request during normal browsing.
    // The 90s threshold matches the isTokenExpired buffer above, so the two paths
    // stay in sync — once the timer fires and rotates the token, isTokenExpired
    // won't consider the new token stale until its own 90s window.
    useEffect(() => {
        if (!accessToken || !refreshToken) return;
        try {
            const payload = JSON.parse(atob(accessToken.split(".")[1])) as { exp?: number };
            if (!payload.exp) return;
            const msUntilRefresh = payload.exp * 1000 - Date.now() - 90_000;
            if (msUntilRefresh <= 0) {
                authLog("proactiveRefresh: token already within 90s of expiry — skipping timer, 401-retry path will handle it");
                return;
            }
            const fireAt = new Date(Date.now() + msUntilRefresh).toISOString();
            authLog("proactiveRefresh: timer scheduled", {
                firesAt: fireAt,
                inSeconds: Math.round(msUntilRefresh / 1000),
            });
            const timer = setTimeout(() => {
                authLog("proactiveRefresh: timer fired — refreshing proactively");
                void tryRefreshToken();
            }, msUntilRefresh);
            return () => {
                authLog("proactiveRefresh: timer cleared (token or deps changed before it fired)");
                clearTimeout(timer);
            };
        } catch {
            // Malformed access token — let the 401-retry path handle recovery
        }
    }, [accessToken, refreshToken, tryRefreshToken]);

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
