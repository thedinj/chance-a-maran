/**
 * Persists the list of device player IDs for a session.
 *
 * When a secondary device player is added via AddPlayerModal, their ID is
 * stored here so the pill strip can be restored after a page refresh or
 * app restart without requiring manual re-add.
 *
 * Native: persisted via @capacitor/preferences (survives app restarts).
 * Web: persisted via localStorage (survives page reloads).
 */
import { Capacitor } from "@capacitor/core";

const PREFIX = "device_players:";

async function getPreferences() {
    const { Preferences } = await import("@capacitor/preferences");
    return Preferences;
}

export const devicePlayersStore = {
    async get(sessionId: string): Promise<string[]> {
        try {
            const k = `${PREFIX}${sessionId}`;
            if (Capacitor.isNativePlatform()) {
                const prefs = await getPreferences();
                const { value } = await prefs.get({ key: k });
                return value ? (JSON.parse(value) as string[]) : [];
            }
            const raw = localStorage.getItem(k);
            return raw ? (JSON.parse(raw) as string[]) : [];
        } catch {
            return [];
        }
    },

    async set(sessionId: string, playerIds: string[]): Promise<void> {
        const k = `${PREFIX}${sessionId}`;
        const v = JSON.stringify(playerIds);
        if (Capacitor.isNativePlatform()) {
            const prefs = await getPreferences();
            await prefs.set({ key: k, value: v });
        } else {
            localStorage.setItem(k, v);
        }
    },

    async clear(sessionId: string): Promise<void> {
        try {
            const k = `${PREFIX}${sessionId}`;
            if (Capacitor.isNativePlatform()) {
                const prefs = await getPreferences();
                await prefs.remove({ key: k });
            } else {
                localStorage.removeItem(k);
            }
        } catch {
            // ignore
        }
    },
};
