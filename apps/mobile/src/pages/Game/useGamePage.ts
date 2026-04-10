import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useCards } from "../../cards/useCards";
import type { CardTransfer, DrawEvent, Player, Session } from "../../lib/api";
import { apiClient } from "../../lib/api";
import { hapticMedium } from "../../lib/haptics";
import { useExitSession } from "../../session/useExitSession";
import { useSession } from "../../session/useSession";
import { useTransfers } from "../../transfers/useTransfers";
import type { DrawDrama } from "./types";
import { GAME_CHANGER_DRAMA, REPARATIONS_DRAMA, STANDARD_DRAW_DRAMA } from "./types";

// Tracks which session IDs have already auto-shown the join code so navigation
// away and back does not trigger it again.
const joinCodeShownSessions = new Set<string>();

export interface UseGamePageReturn {
    // From context
    session: Session | null;
    players: Player[];
    activePlayerId: string | null;
    devicePlayerIds: string[];
    isGuest: boolean;
    accessToken: string | null;
    pendingTransfers: CardTransfer[];
    history: ReturnType<typeof useHistory>;
    addDevicePlayer: (id: string) => void;
    setActivePlayer: (id: string) => void;
    drawHistory: DrawEvent[];

    // Computed
    isActivePlayerOnDevice: boolean;
    displayCards: DrawEvent[];
    resolvedCards: DrawEvent[];

    // UI state
    selectedCard: DrawEvent | null;
    setSelectedCard: React.Dispatch<React.SetStateAction<DrawEvent | null>>;
    revealCard: DrawEvent | null;
    revealDrama: DrawDrama | null;
    onDismissReveal: () => void;
    showJoinCode: boolean;
    setShowJoinCode: React.Dispatch<React.SetStateAction<boolean>>;
    showAddPlayer: boolean;
    setShowAddPlayer: React.Dispatch<React.SetStateAction<boolean>>;
    showClaim: boolean;
    setShowClaim: React.Dispatch<React.SetStateAction<boolean>>;
    showResolved: boolean;
    setShowResolved: React.Dispatch<React.SetStateAction<boolean>>;
    showReparationsConfirm: boolean;
    setShowReparationsConfirm: React.Dispatch<React.SetStateAction<boolean>>;
    actionSheetTarget: Player | null;
    setActionSheetTarget: React.Dispatch<React.SetStateAction<Player | null>>;
    error: string | null;
    drawPending: boolean;
    reparationsPending: boolean;

    // Handlers
    handleDraw: () => void;
    handleDrawReparations: () => void;
    handleVote: (cardId: string, direction: "up" | "down" | null) => Promise<void>;
    handleResolve: (drawEventId: string, resolved: boolean) => Promise<void>;
    handleTransfer: (drawEventId: string, toPlayerId: string) => Promise<void>;
    handleCancelTransfer: (transferId: string) => Promise<void>;
    handleShareDescription: (drawEventId: string) => Promise<boolean>;
    handleLeaveOrRemove: () => Promise<void>;
}

export function useGamePage(): UseGamePageReturn {
    const history = useHistory();
    const location = useLocation<{ newSession?: boolean }>();
    const exitSession = useExitSession();
    const {
        session,
        players,
        activePlayerId,
        devicePlayerIds,
        localPlayer,
        setActivePlayer,
        addDevicePlayer,
        removeDevicePlayer,
        setSession,
    } = useSession();
    const { drawHistory, addDrawEvent, updateDrawEvent } = useCards();
    const { pendingTransfers, setPendingTransfers, removeTransfer } = useTransfers();

    const [selectedCard, setSelectedCard] = useState<DrawEvent | null>(null);
    const [revealCard, setRevealCard] = useState<DrawEvent | null>(null);
    const [revealDrama, setRevealDrama] = useState<DrawDrama | null>(null);
    const [showJoinCode, setShowJoinCode] = useState(false);
    const [showAddPlayer, setShowAddPlayer] = useState(false);
    const [showClaim, setShowClaim] = useState(false);
    const [showResolved, setShowResolved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [drawPending, startDrawTransition] = useTransition();
    const [reparationsPending, startReparationsTransition] = useTransition();
    const [showReparationsConfirm, setShowReparationsConfirm] = useState(false);
    const [actionSheetTarget, setActionSheetTarget] = useState<Player | null>(null);
    const { isGuest, accessToken } = useAuth();

    // Redirect if no session
    useEffect(() => {
        if (!session) {
            history.replace("/");
        }
    }, [session, history]);

    // Auto-show join code only when the host creates a brand-new session
    useEffect(() => {
        if (
            session &&
            localPlayer?.id === session.hostPlayerId &&
            location.state?.newSession === true &&
            !joinCodeShownSessions.has(session.id)
        ) {
            joinCodeShownSessions.add(session.id);
            setShowJoinCode(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // Session polling — fires immediately on mount, then every 5s
    useEffect(() => {
        if (!session) return;

        async function poll() {
            const result = await apiClient.getSessionState(session!.id);
            if (!result.ok) return;
            setSession(result.data);
            for (const event of result.data.drawEvents ?? []) {
                addDrawEvent(event);
            }
            // Sync pending transfers — filter to transfers involving this device's players
            const relevant = (result.data.pendingTransfers ?? []).filter(
                (t) =>
                    devicePlayerIds.includes(t.fromPlayerId) ||
                    devicePlayerIds.includes(t.toPlayerId)
            );
            setPendingTransfers(relevant);
        }

        poll();
        const intervalId = setInterval(poll, 5000);
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // Active player derivation — true only if the active player is on this device AND still active (not left)
    const isActivePlayerOnDevice = useMemo(() => {
        if (!activePlayerId) return false;
        if (!devicePlayerIds.includes(activePlayerId)) return false;
        return players.find((p) => p.id === activePlayerId)?.active ?? false;
    }, [activePlayerId, devicePlayerIds, players]);

    // Card stack derivation
    const playerCards = useMemo(
        () => drawHistory.filter((event) => event.playerId === activePlayerId),
        [activePlayerId, drawHistory]
    );
    const activeCards = useMemo(
        () =>
            playerCards
                .filter((event) => !event.resolved)
                .sort((a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime()),
        [playerCards]
    );
    const resolvedCards = useMemo(
        () =>
            playerCards
                .filter((event) => event.resolved)
                .sort((a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime()),
        [playerCards]
    );
    const displayCards = useMemo(
        () => (showResolved ? [...activeCards, ...resolvedCards] : activeCards),
        [activeCards, resolvedCards, showResolved]
    );

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleDraw = useCallback(() => {
        if (!session || !activePlayerId) return;
        setError(null);
        hapticMedium();
        startDrawTransition(async () => {
            const result = await apiClient.drawCard(session.id, activePlayerId);
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            addDrawEvent(result.data);
            const prefersReduced =
                typeof window !== "undefined" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const isGameChanger = Boolean(result.data.cardVersion.isGameChanger);
            setRevealDrama(
                prefersReduced ? null : isGameChanger ? GAME_CHANGER_DRAMA : STANDARD_DRAW_DRAMA
            );
            setRevealCard(result.data);
        });
    }, [activePlayerId, addDrawEvent, session, startDrawTransition]);

    const handleDrawReparations = useCallback(() => {
        if (!session || !activePlayerId) return;
        setError(null);
        hapticMedium();
        startReparationsTransition(async () => {
            const result = await apiClient.drawReparationsCard(session.id, activePlayerId);
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            addDrawEvent(result.data);
            const prefersReduced =
                typeof window !== "undefined" &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            setRevealDrama(prefersReduced ? null : REPARATIONS_DRAMA);
            setRevealCard(result.data);
        });
    }, [activePlayerId, addDrawEvent, session, startReparationsTransition]);

    const handleVote = useCallback(async (cardId: string, direction: "up" | "down" | null) => {
        if (direction === null) {
            await apiClient.clearVote(cardId);
        } else {
            await apiClient.voteCard(cardId, direction);
        }
    }, []);

    const handleResolve = useCallback(
        async (drawEventId: string, resolved: boolean) => {
            const result = await apiClient.resolveCard(drawEventId, resolved);
            if (result.ok) updateDrawEvent(result.data);
        },
        [updateDrawEvent]
    );

    const handleTransfer = useCallback(
        async (drawEventId: string, toPlayerId: string) => {
            if (!activePlayerId) return;
            const result = await apiClient.createTransfer(drawEventId, activePlayerId, toPlayerId);
            if (result.ok) {
                // Replace any existing pending transfer for this card with the new one
                setPendingTransfers((prev) => [
                    ...prev.filter((t) => t.drawEventId !== drawEventId),
                    result.data,
                ]);
            }
        },
        [activePlayerId, setPendingTransfers]
    );

    const handleCancelTransfer = useCallback(
        async (transferId: string) => {
            if (!activePlayerId) return;
            const result = await apiClient.cancelTransfer(transferId, activePlayerId);
            if (result.ok) removeTransfer(transferId);
        },
        [activePlayerId, removeTransfer]
    );

    const handleShareDescription = useCallback(
        async (drawEventId: string): Promise<boolean> => {
            const result = await apiClient.shareDescription(drawEventId);
            if (result.ok) {
                updateDrawEvent(result.data);
                if (selectedCard?.id === drawEventId) setSelectedCard(result.data);
                return true;
            }
            return false;
        },
        [selectedCard, updateDrawEvent]
    );

    const handleLeaveOrRemove = useCallback(async () => {
        if (!actionSheetTarget || !session) return;
        const hasCards = drawHistory.some((e) => e.playerId === actionSheetTarget.id);
        const leaveResult = await apiClient.leaveSession(session.id, actionSheetTarget.id);
        if (!leaveResult.ok) {
            setError(leaveResult.error.message);
            setActionSheetTarget(null);
            return;
        }
        if (!hasCards) removeDevicePlayer(actionSheetTarget.id);
        const remainingDeviceIds = hasCards
            ? devicePlayerIds
            : devicePlayerIds.filter((id) => id !== actionSheetTarget.id);
        let nextPlayers = players;
        const updated = await apiClient.getSessionState(session.id);
        if (updated.ok) {
            nextPlayers = updated.data.players;
            const hasRemainingActive = updated.data.players.some(
                (p) => remainingDeviceIds.includes(p.id) && p.active
            );
            if (!hasRemainingActive) {
                exitSession();
                history.replace("/");
                return;
            }
            setSession(updated.data);
        }
        if (activePlayerId === actionSheetTarget.id) {
            const nextId =
                nextPlayers.find(
                    (p) =>
                        remainingDeviceIds.includes(p.id) &&
                        p.id !== actionSheetTarget.id &&
                        p.active
                )?.id ??
                nextPlayers.find((p) => p.id !== actionSheetTarget.id && p.active)?.id ??
                remainingDeviceIds.find((id) => id !== actionSheetTarget.id);
            if (nextId) setActivePlayer(nextId);
        }
        setActionSheetTarget(null);
    }, [
        actionSheetTarget,
        session,
        drawHistory,
        removeDevicePlayer,
        devicePlayerIds,
        players,
        exitSession,
        setSession,
        activePlayerId,
        setActivePlayer,
        history,
    ]);

    const onDismissReveal = useCallback(() => {
        setRevealCard(null);
        setRevealDrama(null);
    }, []);

    return {
        session,
        players,
        activePlayerId,
        devicePlayerIds,
        isGuest,
        accessToken,
        pendingTransfers,
        history,
        addDevicePlayer,
        setActivePlayer,
        drawHistory,
        isActivePlayerOnDevice,
        displayCards,
        resolvedCards,
        selectedCard,
        setSelectedCard,
        revealCard,
        revealDrama,
        onDismissReveal,
        showJoinCode,
        setShowJoinCode,
        showAddPlayer,
        setShowAddPlayer,
        showClaim,
        setShowClaim,
        showResolved,
        setShowResolved,
        showReparationsConfirm,
        setShowReparationsConfirm,
        actionSheetTarget,
        setActionSheetTarget,
        error,
        drawPending,
        reparationsPending,
        handleDraw,
        handleDrawReparations,
        handleVote,
        handleResolve,
        handleTransfer,
        handleCancelTransfer,
        handleShareDescription,
        handleLeaveOrRemove,
    };
}
