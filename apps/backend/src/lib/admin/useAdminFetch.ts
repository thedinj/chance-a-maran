"use client";

import { useCallback, useRef } from "react";
import type { ApiResult } from "@chance/core";
import { useAdminSession } from "./useAdminSession";
import { authLog, authWarn, tokenExpiry } from "./authDebug";

/**
 * Unwraps the standard API envelope `{ ok, data, serverTimestamp }`.
 * Throws with the server's error message on failure.
 */
export async function parseApiResult<T>(response: Response): Promise<T> {
    const envelope = (await response.json()) as ApiResult<T>;
    if (!envelope.ok) throw new Error(envelope.error.message);
    return envelope.data;
}

export function useAdminFetch() {
    const { accessToken, tryRefreshToken, logout } = useAdminSession();

    // Keep a ref so the initial request always reads the latest token without
    // adding accessToken to the useCallback dep array (which would recreate
    // adminFetch on every token rotation and break memoized callers).
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;

    const adminFetch = useCallback(
        async (url: string, options: RequestInit = {}): Promise<Response> => {
            const doFetch = (token: string | null) => {
                const headers = new Headers(options.headers);
                headers.set("Content-Type", "application/json");
                if (token) headers.set("Authorization", `Bearer ${token}`);
                return fetch(url, { ...options, headers });
            };

            const response = await doFetch(tokenRef.current);

            // Extract just the path for safe logging (no query params / sensitive data)
            const path = (() => {
                try { return new URL(url, "http://x").pathname; } catch { return url; }
            })();

            if (response.status === 401) {
                authWarn("adminFetch: 401 — attempting token refresh before retry", {
                    path,
                    currentToken: tokenExpiry(tokenRef.current),
                });

                // Use the token returned directly from tryRefreshToken rather than
                // tokenRef.current: React state hasn't updated yet (no re-render has
                // happened), so tokenRef.current still holds the expired token.
                const freshToken = await tryRefreshToken();

                if (freshToken) {
                    authLog("adminFetch: refresh succeeded — retrying original request", {
                        path,
                        freshToken: tokenExpiry(freshToken),
                    });
                    return doFetch(freshToken);
                }

                authWarn("adminFetch: refresh failed — returning original 401 (user will be redirected to login)", {
                    path,
                });
            }

            if (response.status === 403) {
                // 403 means the JWT is valid but admin privileges are denied — this
                // cannot be fixed by refreshing the token. Clear the session so the
                // user lands on the login page rather than staying on a broken admin view.
                authWarn("adminFetch: 403 — admin privileges denied, clearing session", { path });
                void logout();
            }

            return response;
        },
        [tryRefreshToken, logout]
    );

    return adminFetch;
}
