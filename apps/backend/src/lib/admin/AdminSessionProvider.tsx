"use client";

import type { User } from "@basket-bot/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSessionContext } from "./AdminSessionContext";

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

    // Refresh access token using refresh token
    const refreshAccessToken = useCallback(
        async (currentRefreshToken: string): Promise<boolean> => {
            try {
                const response = await fetch("/api/auth/refresh", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refreshToken: currentRefreshToken }),
                });

                if (!response.ok) {
                    return false;
                }

                const data = await response.json();

                // Verify admin scope
                if (!data.user.scopes || !data.user.scopes.includes("admin")) {
                    return false;
                }

                persistSession(data.accessToken, data.refreshToken, data.user);
                return true;
            } catch (error) {
                console.error("Token refresh failed:", error);
                return false;
            }
        },
        [persistSession]
    );

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                // Try to restore from localStorage
                const storedRefreshToken = localStorage.getItem(STORAGE_REFRESH_TOKEN_KEY);

                if (storedRefreshToken) {
                    // Always try to refresh on mount to get a fresh access token
                    const success = await refreshAccessToken(storedRefreshToken);
                    if (success) {
                        setIsLoading(false);
                        return;
                    }
                }

                // No valid session
                clearSession();
            } catch (error) {
                console.error("Session check failed:", error);
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Login failed");
            }

            const data = await response.json();

            // Verify admin scope
            if (!data.user.scopes || !data.user.scopes.includes("admin")) {
                throw new Error("Access denied: admin privileges required");
            }

            persistSession(data.accessToken, data.refreshToken, data.user);
        },
        [persistSession]
    );

    const logout = useCallback(async () => {
        try {
            // Note: logout endpoint expects refresh token in body, but we're not using server-side token revocation for now
            // Just clear local session
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            clearSession();
        }
    }, [clearSession]);

    const tryRefreshToken = useCallback(async (): Promise<boolean> => {
        if (!refreshToken) {
            return false;
        }
        return await refreshAccessToken(refreshToken);
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
