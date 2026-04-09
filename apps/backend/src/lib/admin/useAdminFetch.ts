"use client";

import { useCallback, useRef } from "react";
import type { ApiResult } from "@chance/core";
import { useAdminSession } from "./useAdminSession";

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
    const { accessToken, tryRefreshToken } = useAdminSession();

    // Keep a ref so the retry closure always reads the latest token after refresh
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

            // On 401, try to refresh and replay once
            if (response.status === 401) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    return doFetch(tokenRef.current);
                }
            }

            return response;
        },
        [tryRefreshToken]
    );

    return adminFetch;
}
