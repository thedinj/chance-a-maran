import React, { createContext, useCallback, useContext, useState } from "react";
import type { FilterSettings, Player, Session, SessionState } from "../lib/api";

interface SessionContextValue {
    session: Session | null;
    players: Player[];
    /** The player currently taking their turn on this device. */
    activePlayerId: string | null;
    /** This device's own player record (may differ from activePlayerId on shared-device mode). */
    localPlayer: Player | null;
    setSession(state: SessionState): void;
    setActivePlayer(playerId: string): void;
    clearSession(): void;
    updateFilters(settings: FilterSettings): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [session, setSessionData] = useState<Session | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
    const [localPlayer, setLocalPlayer] = useState<Player | null>(null);

    const setSession = useCallback((state: SessionState) => {
        setSessionData(state.session);
        setPlayers(state.players);
        // On first load, set the local player if we don't have one yet
        setLocalPlayer((prev) => {
            if (prev) return state.players.find((p) => p.id === prev.id) ?? prev;
            return null;
        });
        setActivePlayerId((prev) => prev ?? (state.players[0]?.id ?? null));
    }, []);

    const setActivePlayer = useCallback((playerId: string) => {
        setActivePlayerId(playerId);
    }, []);

    const clearSession = useCallback(() => {
        setSessionData(null);
        setPlayers([]);
        setActivePlayerId(null);
        setLocalPlayer(null);
    }, []);

    const updateFilters = useCallback((settings: FilterSettings) => {
        setSessionData((prev) => prev ? { ...prev, filterSettings: settings } : null);
    }, []);

    return (
        <SessionContext.Provider
            value={{ session, players, activePlayerId, localPlayer, setSession, setActivePlayer, clearSession, updateFilters }}
        >
            {children}
        </SessionContext.Provider>
    );
}

export function useSession(): SessionContextValue {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error("useSession must be used within SessionProvider");
    return ctx;
}
