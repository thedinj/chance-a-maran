import { createContext, useContext } from "react";
import type { FilterSettings, Player, Session, SessionState } from "../lib/api";

export interface SessionContextValue {
    session: Session | null;
    players: Player[];
    /** The player currently taking their turn on this device. */
    activePlayerId: string | null;
    /** IDs of all players joined on this device (primary + secondary guests). */
    devicePlayerIds: string[];
    /** The primary player on this device — the registered user's player, or the first guest to join. */
    localPlayer: Player | null;
    /**
     * Called once after joining a session — establishes this device's player identity.
     * Use setSession() for subsequent polling updates.
     */
    initSession(state: SessionState, myPlayerId: string): void;
    /** Called when a secondary guest player is added via the player switcher. */
    addDevicePlayer(playerId: string): void;
    /** Called when a device player is fully removed (no draw history). Does not affect players who left with cards. */
    removeDevicePlayer(playerId: string): void;
    /** Called from session polling — updates state without resetting device player identity. */
    setSession(state: SessionState): void;
    setActivePlayer(playerId: string): void;
    clearSession(): void;
    /** Replaces the session object — called after a successful updateSessionSettings API response. */
    updateSession(session: Session): void;
    /**
     * Optimistically applies a partial patch to the local player record after a
     * successful updatePlayerSettings API call. Extend the Pick union as new
     * per-player settings are added.
     */
    updateLocalPlayer(
        playerId: string,
        patch: Partial<Pick<Player, "displayName" | "cardSharing">>
    ): void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error("useSession must be used within SessionProvider");
    return ctx;
}
