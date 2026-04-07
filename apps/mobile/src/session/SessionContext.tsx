import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Player, Session, SessionState } from "../lib/api";
import { devicePlayersStore } from "../lib/devicePlayersStore";
import { SessionContext } from "./useSession";

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [session, setSessionData] = useState<Session | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
    const [devicePlayerIds, setDevicePlayerIds] = useState<string[]>([]);
    const [localPlayer, setLocalPlayer] = useState<Player | null>(null);

    // Ref so addDevicePlayer/removeDevicePlayer callbacks can always access the
    // current session ID without stale closures.
    const sessionIdRef = useRef<string | null>(null);

    const initSession = useCallback((state: SessionState, myPlayerId: string) => {
        sessionIdRef.current = state.session.id;
        setSessionData(state.session);
        setPlayers(state.players);
        setDevicePlayerIds([myPlayerId]);
        setLocalPlayer(state.players.find((p) => p.id === myPlayerId) ?? null);
        setActivePlayerId(myPlayerId);
    }, []);

    // Restore any additional device players that were persisted from a prior session.
    // Keyed on session ID so it fires once per session, not on every poll.
    useEffect(() => {
        if (!session) return;
        const sessionId = session.id;
        void (async () => {
            const stored = await devicePlayersStore.get(sessionId);
            if (stored.length === 0) return;
            const activeIds = new Set(players.filter((p) => p.active).map((p) => p.id));
            const valid = stored.filter((id) => activeIds.has(id));
            if (valid.length > 0) {
                setDevicePlayerIds((prev) => [...new Set([...prev, ...valid])]);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    const addDevicePlayer = useCallback((playerId: string) => {
        setDevicePlayerIds((prev) => {
            if (prev.includes(playerId)) return prev;
            const next = [...prev, playerId];
            if (sessionIdRef.current) void devicePlayersStore.set(sessionIdRef.current, next);
            return next;
        });
    }, []);

    const removeDevicePlayer = useCallback((playerId: string) => {
        setDevicePlayerIds((prev) => {
            const next = prev.filter((id) => id !== playerId);
            if (sessionIdRef.current) void devicePlayersStore.set(sessionIdRef.current, next);
            return next;
        });
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
        if (sessionIdRef.current) void devicePlayersStore.clear(sessionIdRef.current);
        sessionIdRef.current = null;
        setSessionData(null);
        setPlayers([]);
        setActivePlayerId(null);
        setDevicePlayerIds([]);
        setLocalPlayer(null);
    }, []);

    const updateSession = useCallback((session: Session) => {
        setSessionData(session);
    }, []);

    const updateLocalPlayer = useCallback(
        (playerId: string, patch: Partial<Pick<Player, "displayName" | "cardSharing">>) => {
            setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, ...patch } : p)));
            setLocalPlayer((prev) => (prev?.id === playerId ? { ...prev, ...patch } : prev));
        },
        []
    );

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
                updateSession,
                updateLocalPlayer,
            }}
        >
            {children}
        </SessionContext.Provider>
    );
}
