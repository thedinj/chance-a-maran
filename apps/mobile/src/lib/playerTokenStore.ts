/**
 * Device-binding token store for guest player rejoin.
 *
 * When a guest player successfully joins a session, the server issues a
 * `playerToken` that proves this device "owns" that name slot. On subsequent
 * joins with the same code + name, the token is passed so the server can do a
 * silent resume instead of rejecting as a duplicate name.
 *
 * Keyed by `JOIN_CODE:displayname_lower` so the lookup only requires information
 * the user has already entered (no session ID needed at lookup time).
 *
 * Native: persisted via @capacitor/preferences (survives app restarts).
 * Web: persisted via localStorage (survives page reloads, cleared on clear-site-data).
 */
import { Capacitor } from "@capacitor/core";

const STORAGE_PREFIX = "player_token:";

function storeKey(joinCode: string, displayName: string): string {
    return `${STORAGE_PREFIX}${joinCode.toUpperCase()}:${displayName.trim().toLowerCase()}`;
}

async function getPreferences() {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
}

export const playerTokenStore = {
    async get(joinCode: string, displayName: string): Promise<string | undefined> {
        const key = storeKey(joinCode, displayName);
        try {
            if (Capacitor.isNativePlatform()) {
                const prefs = await getPreferences();
                const { value } = await prefs.get({ key });
                return value ?? undefined;
            }
            return localStorage.getItem(key) ?? undefined;
        } catch {
            return undefined;
        }
    },

    async set(joinCode: string, displayName: string, token: string): Promise<void> {
        const key = storeKey(joinCode, displayName);
        if (Capacitor.isNativePlatform()) {
            const prefs = await getPreferences();
            await prefs.set({ key, value: token });
        } else {
            localStorage.setItem(key, token);
        }
    },

    async clear(joinCode: string, displayName: string): Promise<void> {
        const key = storeKey(joinCode, displayName);
        try {
            if (Capacitor.isNativePlatform()) {
                const prefs = await getPreferences();
                await prefs.remove({ key });
            } else {
                localStorage.removeItem(key);
            }
        } catch {
            // Ignore
        }
    },
};
