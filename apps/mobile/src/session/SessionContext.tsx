import React, { useCallback, useState } from "react";
import type { FilterSettings, Player, Session, SessionState } from "../lib/api";
import { SessionContext } from "./useSession";

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [session, setSessionData] = useState<Session | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
    const [devicePlayerIds, setDevicePlayerIds] = useState<string[]>([]);
    const [localPlayer, setLocalPlayer] = useState<Player | null>(null);

    const initSession = useCallback((state: SessionState, myPlayerId: string) => {
        setSessionData(state.session);
        setPlayers(state.players);
        setDevicePlayerIds([myPlayerId]);
        setLocalPlayer(state.players.find((p) => p.id === myPlayerId) ?? null);
        setActivePlayerId(myPlayerId);
    }, []);

    const addDevicePlayer = useCallback((playerId: string) => {
        setDevicePlayerIds((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
    }, []);

    const removeDevicePlayer = useCallback((playerId: string) => {
        setDevicePlayerIds((prev) => prev.filter((id) => id !== playerId));
    }, []);

    const setSession = useCallback((state: SessionState) => {
        setSessionData(state.session);
        setPlayers(state.players);
        // Keep localPlayer reference current without resetting device identity
        setLocalPlayer((prev) =>
            prev ? (state.players.find((p) => p.id === prev.id) ?? prev) : null
        );
    }, []);

    const setActivePlayer = useCallback((playerId: string) => {
        setActivePlayerId(playerId);
    }, []);

    const clearSession = useCallback(() => {
        setSessionData(null);
        setPlayers([]);
        setActivePlayerId(null);
        setDevicePlayerIds([]);
        setLocalPlayer(null);
    }, []);

    const updateFilters = useCallback((settings: FilterSettings) => {
        setSessionData((prev) => (prev ? { ...prev, filterSettings: settings } : null));
    }, []);

    return (
        <SessionContext.Provider
            value={{
                session,
                players,
                activePlayerId,
                devicePlayerIds,
                localPlayer,
                initSession,
                addDevicePlayer,
                removeDevicePlayer,
                setSession,
                setActivePlayer,
                clearSession,
                updateFilters,
            }}
        >
            {children}
        </SessionContext.Provider>
    );
}
