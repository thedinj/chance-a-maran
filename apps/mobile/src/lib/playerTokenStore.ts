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
 * TODO: migrate to Capacitor Preferences for cross-restart persistence.
 * Current in-memory implementation clears on every app launch.
 */

const _store = new Map<string, string>();

function storeKey(joinCode: string, displayName: string): string {
    return `${joinCode.toUpperCase()}:${displayName.trim().toLowerCase()}`;
}

export const playerTokenStore = {
    get(joinCode: string, displayName: string): string | undefined {
        return _store.get(storeKey(joinCode, displayName));
    },

    set(joinCode: string, displayName: string, token: string): void {
        _store.set(storeKey(joinCode, displayName), token);
    },

    /** Called when the host resets a player's identity — token is no longer valid. */
    clear(joinCode: string, displayName: string): void {
        _store.delete(storeKey(joinCode, displayName));
    },
};
