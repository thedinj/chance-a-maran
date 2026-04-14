/* eslint-disable no-console */
// Toggle to false to silence admin auth diagnostics in the browser console.
export const ADMIN_AUTH_DEBUG = true;

type LogData = Record<string, unknown>;

function ts(): string {
    return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

export function authLog(label: string, data?: LogData): void {
    if (!ADMIN_AUTH_DEBUG) return;
    data !== undefined
        ? console.log(`[AdminAuth ${ts()}] ${label}`, data)
        : console.log(`[AdminAuth ${ts()}] ${label}`);
}

export function authWarn(label: string, data?: LogData): void {
    if (!ADMIN_AUTH_DEBUG) return;
    data !== undefined
        ? console.warn(`[AdminAuth ${ts()}] ${label}`, data)
        : console.warn(`[AdminAuth ${ts()}] ${label}`);
}

export function authError(label: string, data?: LogData): void {
    if (!ADMIN_AUTH_DEBUG) return;
    data !== undefined
        ? console.error(`[AdminAuth ${ts()}] ${label}`, data)
        : console.error(`[AdminAuth ${ts()}] ${label}`);
}

/**
 * Decodes the exp claim from a JWT and returns a human-readable expiry string.
 * Never logs the token value itself — only the timing metadata.
 */
export function tokenExpiry(token: string | null): string {
    if (!token) return "(no token)";
    try {
        const payload = JSON.parse(atob(token.split(".")[1])) as { exp?: number };
        if (!payload.exp) return "(no exp claim)";
        const expiresAt = new Date(payload.exp * 1000).toISOString();
        const remainingSec = Math.round((payload.exp * 1000 - Date.now()) / 1000);
        return `expires ${expiresAt} (${remainingSec}s from now)`;
    } catch {
        return "(malformed token)";
    }
}
