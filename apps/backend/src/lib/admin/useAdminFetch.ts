"use client";

import { useCallback } from "react";
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
    const { accessToken } = useAdminSession();

    const adminFetch = useCallback(
        (url: string, options: RequestInit = {}): Promise<Response> => {
            const headers = new Headers(options.headers);
            headers.set("Content-Type", "application/json");
            if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
            return fetch(url, { ...options, headers });
        },
        [accessToken]
    );

    return adminFetch;
}
