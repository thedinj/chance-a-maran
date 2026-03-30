import { IonContent, IonFooter, IonHeader, IonMenuButton, IonPage, IonToolbar } from "@ionic/react";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useCards } from "../cards/useCards";
import type { DrawEvent, Player } from "../lib/api";
import { apiClient } from "../lib/api";
import { hapticLight, hapticMedium } from "../lib/haptics";
import { useSession } from "../session/useSession";
import { FlippingCard } from "../components/GameCard";

// ─── Fan layout constants ────────────────────────────────────────────────────

const CARD_HEIGHT = 260; // px — 3:4 ratio at mobile width
const PEEK_HEIGHT = 72; // px — title + player chip visible below each card

// ─── Sub-components ──────────────────────────────────────────────────────────

interface GameHeaderProps {
    sessionName: string;
    onJoinCode: () => void;
}

interface GameHeaderProps {
    sessionName: string;
    onJoinCode: () => void;
    players: Player[];
    devicePlayerIds: string[];
    activePlayerId: string | null;
    onSwitchPlayer: (playerId: string) => void;
}

function GameHeader({
    sessionName,
    onJoinCode,
    players,
    devicePlayerIds,
    activePlayerId,
    onSwitchPlayer,
}: GameHeaderProps) {
    const devicePlayers = players.filter((p) => devicePlayerIds.includes(p.id));
    return (
        <IonHeader>
            <IonToolbar style={styles.toolbar as React.CSSProperties}>
                <div style={styles.headerInner}>
                    <IonMenuButton style={styles.menuButton as React.CSSProperties} />
                    <h1 style={styles.sessionName}>{sessionName}</h1>
                    <button
                        style={styles.joinCodeButton}
                        onClick={onJoinCode}
                        aria-label="Show join code"
                    >
                        <span style={styles.joinCodeIcon}>⊞</span>
                    </button>
                </div>
            </IonToolbar>
            {/* Player switcher lives inside IonHeader so it never scrolls away */}
            <div style={styles.switcherWrap}>
                <div style={styles.switcherStrip}>
                    {devicePlayers.map((p) => {
                        const isActive = p.id === activePlayerId;
                        return (
                            <button
                                key={p.id}
                                style={isActive ? styles.pillActive : styles.pillInactive}
                                onClick={() => {
                                    hapticLight();
                                    onSwitchPlayer(p.id);
                                }}
                            >
                                {p.displayName}
                            </button>
                        );
                    })}
                    <button style={styles.pillAdd} disabled>
                        +
                    </button>
                </div>
            </div>
        </IonHeader>
    );
}

// ── CardFanItem ───────────────────────────────────────────────────────────────

interface CardFanItemProps {
    event: DrawEvent;
    index: number;
    players: Player[];
    activePlayerId: string | null;
    onTap: (event: DrawEvent) => void;
}

function CardFanItem({ event, index, players, activePlayerId, onTap }: CardFanItemProps) {
    const isTop = index === 0;
    const isPeek = !isTop;
    const cv = event.cardVersion;
    const isResolved = event.resolved;
    const player = players.find((p) => p.id === event.playerId);
    const isDrawer = event.playerId === activePlayerId;

    const showHiddenBadge = cv.hiddenDescription && !event.descriptionShared && isTop && !isDrawer;

    return (
        <div
            style={{
                ...styles.cardWrapper,
                // Peek cards: wrapper is clipped to PEEK_HEIGHT, showing only the top
                // of the card (title + chip). No negative margins — cards stack downward.
                height: isPeek ? PEEK_HEIGHT : CARD_HEIGHT,
                overflow: "hidden",
            }}
            onClick={() => onTap(event)}
        >
            <div
                style={{
                    ...styles.card,
                    height: CARD_HEIGHT,
                    boxShadow: isTop
                        ? "inset 0 0 0 1px var(--color-border), 0 0 20px 2px color-mix(in srgb, var(--color-accent-primary) 25%, transparent)"
                        : "inset 0 0 0 1px var(--color-border)",
                }}
            >
                {/* Resolved amber overlay */}
                {isResolved && <div style={styles.resolvedOverlay} />}

                {/* Corner ornaments */}
                <span style={{ ...styles.cornerDiamond, top: 10, left: 10 }}>◆</span>
                <span style={{ ...styles.cornerDiamond, top: 10, right: 10 }}>◆</span>

                {/* Resolved badge */}
                {isResolved && <div style={styles.resolvedBadge}>RESOLVED</div>}

                {/* Card content */}
                <div style={styles.cardContent}>
                    <p style={styles.cardTitle}>{cv.title}</p>
                    <p style={styles.cardPlayerChip}>
                        {player?.displayName ?? "Unknown"} ◆{" "}
                        {new Date(event.drawnAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </p>
                </div>

                {/* Hidden badge (top card only, not the drawer) */}
                {showHiddenBadge && <div style={styles.hiddenBadge}>HIDDEN</div>}
            </div>
        </div>
    );
}

// ── CardStack ─────────────────────────────────────────────────────────────────

interface CardStackProps {
    events: DrawEvent[];
    players: Player[];
    activePlayerId: string | null;
    showResolved: boolean;
    onCardTap: (event: DrawEvent) => void;
    onToggleResolved: () => void;
    resolvedCount: number;
}

function CardStack({
    events,
    players,
    activePlayerId,
    showResolved,
    onCardTap,
    onToggleResolved,
    resolvedCount,
}: CardStackProps) {
    if (events.length === 0) {
        return (
            <div style={styles.emptyState}>
                <div style={styles.emptyLogo}>C</div>
                <p style={styles.emptyTitle}>No cards drawn yet.</p>
                <p style={styles.emptyHint}>Tap Draw when it's your turn.</p>
            </div>
        );
    }

    return (
        <div style={styles.stackOuter}>
            {resolvedCount > 0 && (
                <button style={styles.showResolvedToggle} onClick={onToggleResolved}>
                    {showResolved ? "Hide resolved" : `Show ${resolvedCount} resolved`}
                </button>
            )}
            <div style={styles.stack}>
                {events.map((event, i) => (
                    <CardFanItem
                        key={event.id}
                        event={event}
                        index={i}
                        players={players}
                        activePlayerId={activePlayerId}
                        onTap={onCardTap}
                    />
                ))}
            </div>
        </div>
    );
}

// ── DrawButton ────────────────────────────────────────────────────────────────

interface DrawButtonProps {
    isEnabled: boolean;
    isPending: boolean;
    onDraw: () => void;
}

function DrawButton({ isEnabled, isPending, onDraw }: DrawButtonProps) {
    const [flashing, setFlashing] = useState(false);

    function handleClick() {
        if (!isEnabled || isPending) return;
        setFlashing(true);
        setTimeout(() => setFlashing(false), 220);
        onDraw();
    }

    let borderColor = "var(--color-accent-primary)";
    let labelColor = "var(--color-text-primary)";
    let animName = "drawButtonGlow";

    if (!isEnabled) {
        borderColor = "var(--color-border)";
        labelColor = "var(--color-text-secondary)";
        animName = "none";
    } else if (isPending) {
        animName = "drawButtonPulse";
    } else if (flashing) {
        borderColor = "var(--color-accent-green)";
        animName = "none";
    }

    return (
        <button
            style={{
                ...styles.drawButton,
                borderColor,
                color: labelColor,
                animation: `${animName} ${isPending ? "1s" : "4s"} ease-in-out infinite`,
                opacity: !isEnabled ? 0.6 : 1,
                cursor: !isEnabled ? "default" : "pointer",
            }}
            onClick={handleClick}
            disabled={!isEnabled && !isPending}
        >
            DRAW
        </button>
    );
}

// ── CardRevealOverlay ─────────────────────────────────────────────────────────

interface CardRevealOverlayProps {
    event: DrawEvent;
    onDismiss: () => void;
}

function CardRevealOverlay({ event, onDismiss }: CardRevealOverlayProps) {
    return (
        <div style={styles.overlayBackdrop} onClick={onDismiss}>
            <div style={styles.revealCardWrap} onClick={(e) => e.stopPropagation()}>
                <FlippingCard event={event} />
                <p style={styles.revealDismissHint}>Tap outside to dismiss</p>
            </div>
        </div>
    );
}

// ── CardDetailOverlay ─────────────────────────────────────────────────────────

interface CardDetailOverlayProps {
    event: DrawEvent;
    players: Player[];
    activePlayerId: string | null;
    onDismiss: () => void;
    onVote: (cardId: string, direction: "up" | "down") => Promise<void>;
    onResolve: (drawEventId: string) => Promise<void>;
    onTransfer: (drawEventId: string, toPlayerId: string) => Promise<void>;
    onShareDescription: (drawEventId: string) => Promise<void>;
    allPlayers: Player[];
}

function CardDetailOverlay({
    event,
    players,
    activePlayerId,
    onDismiss,
    onVote,
    onResolve,
    onTransfer,
    onShareDescription,
    allPlayers,
}: CardDetailOverlayProps) {
    const cv = event.cardVersion;
    const isDrawer = event.playerId === activePlayerId;
    const [descrRevealed, setDescrRevealed] = useState(
        !cv.hiddenDescription || event.descriptionShared
    );
    const [voteDir, setVoteDir] = useState<"up" | "down" | null>(null);
    const [resolveRequested, setResolveRequested] = useState(event.resolved);
    const [showTransferPicker, setShowTransferPicker] = useState(false);
    const [transferDone, setTransferDone] = useState(false);
    const [sharing, setSharing] = useState(false);

    const showHiddenToggle =
        cv.hiddenDescription && !event.descriptionShared && isDrawer && !descrRevealed;
    const showShareBtn =
        cv.hiddenDescription && !event.descriptionShared && isDrawer && descrRevealed;

    async function handleVote(dir: "up" | "down") {
        const next = voteDir === dir ? null : dir;
        setVoteDir(next);
        if (next) {
            hapticLight();
            await onVote(cv.cardId, next);
        }
    }

    async function handleResolve() {
        setResolveRequested(true);
        hapticLight();
        await onResolve(event.id);
    }

    async function handleTransfer(toPlayerId: string) {
        setShowTransferPicker(false);
        setTransferDone(true);
        hapticLight();
        await onTransfer(event.id, toPlayerId);
    }

    async function handleShare() {
        setSharing(true);
        hapticLight();
        await onShareDescription(event.id);
        setSharing(false);
    }

    const transferablePlayers = allPlayers.filter((p) => p.id !== event.playerId && p.active);

    return (
        <>
            <style>{`
                .reveal-description::-webkit-scrollbar {
                    width: 6px;
                }
                .reveal-description::-webkit-scrollbar-track {
                    background: transparent;
                }
                .reveal-description::-webkit-scrollbar-thumb {
                    background: var(--color-accent-amber);
                    border-radius: 3px;
                    opacity: 0.6;
                }
                .reveal-description::-webkit-scrollbar-thumb:hover {
                    opacity: 0.8;
                }
            `}</style>
            <div style={styles.overlayBackdrop} onClick={onDismiss}>
                <div style={styles.detailWrap} onClick={(e) => e.stopPropagation()}>
                    {/* Back arrow */}
                    <button style={styles.detailBack} onClick={onDismiss}>
                        ←
                    </button>

                    {/* Card content */}
                    <div style={styles.detailScroll}>
                        <div style={styles.detailCard}>
                            {/* Ornaments */}
                            <span
                                style={{ ...styles.cornerDiamond, top: 12, left: 12, fontSize: 14 }}
                            >
                                ◆
                            </span>
                            <span
                                style={{
                                    ...styles.cornerDiamond,
                                    top: 12,
                                    right: 12,
                                    fontSize: 14,
                                }}
                            >
                                ◆
                            </span>

                            {event.resolved && <div style={styles.resolvedOverlay} />}
                            {event.resolved && <div style={styles.resolvedBadge}>RESOLVED</div>}

                            <div style={styles.detailCardContent}>
                                <p style={styles.revealTitle}>{cv.title}</p>
                                <p style={styles.revealPlayerChip}>
                                    {players.find((p) => p.id === event.playerId)?.displayName ??
                                        "Unknown"}{" "}
                                    ◆{" "}
                                    {new Date(event.drawnAt).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </p>

                                {descrRevealed ? (
                                    <p
                                        style={styles.revealDescription}
                                        className="reveal-description"
                                    >
                                        {cv.description}
                                    </p>
                                ) : showHiddenToggle ? (
                                    <button
                                        style={styles.hiddenDescArea}
                                        onClick={() => setDescrRevealed(true)}
                                    >
                                        <span style={styles.hiddenDescLabel}>
                                            Tap to reveal description
                                        </span>
                                    </button>
                                ) : null}

                                {showShareBtn && (
                                    <button
                                        style={styles.shareDescBtn}
                                        onClick={handleShare}
                                        disabled={sharing}
                                    >
                                        {sharing ? "Sharing..." : "Share with everyone"}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Transfer player picker */}
                        {showTransferPicker && (
                            <div style={styles.transferPicker}>
                                <p style={styles.transferPickerLabel}>TRANSFER TO</p>
                                {transferablePlayers.map((p) => (
                                    <button
                                        key={p.id}
                                        style={styles.transferPlayerBtn}
                                        onClick={() => handleTransfer(p.id)}
                                    >
                                        {p.displayName}
                                    </button>
                                ))}
                                <button
                                    style={styles.transferCancelBtn}
                                    onClick={() => setShowTransferPicker(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Action bar */}
                    <div style={styles.actionBar}>
                        {/* Vote */}
                        <button
                            style={styles.actionBtn}
                            onClick={() => handleVote(voteDir === "up" ? "down" : "up")}
                        >
                            <span
                                style={{
                                    ...styles.actionIcon,
                                    color:
                                        voteDir === "up"
                                            ? "var(--color-accent-amber)"
                                            : voteDir === "down"
                                              ? "var(--color-danger)"
                                              : "var(--color-text-secondary)",
                                }}
                            >
                                {voteDir === "down" ? "↓" : "↑"}
                            </span>
                            <span style={styles.actionLabel}>
                                {voteDir === "down" ? "Down" : "Up"}
                            </span>
                        </button>

                        {/* Resolve */}
                        {!event.resolved && (
                            <button
                                style={styles.actionBtn}
                                onClick={handleResolve}
                                disabled={resolveRequested}
                            >
                                <span
                                    style={{
                                        ...styles.actionIcon,
                                        color: resolveRequested
                                            ? "var(--color-success)"
                                            : "var(--color-text-secondary)",
                                    }}
                                >
                                    ✓
                                </span>
                                <span style={styles.actionLabel}>
                                    {resolveRequested ? "Requested" : "Resolve"}
                                </span>
                            </button>
                        )}

                        {/* Transfer */}
                        {!transferDone && (
                            <button
                                style={styles.actionBtn}
                                onClick={() => setShowTransferPicker((v) => !v)}
                            >
                                <span
                                    style={{
                                        ...styles.actionIcon,
                                        color: "var(--color-text-secondary)",
                                    }}
                                >
                                    ⇄
                                </span>
                                <span style={styles.actionLabel}>Transfer</span>
                            </button>
                        )}

                        {/* Share desc */}
                        {showShareBtn && (
                            <button
                                style={styles.actionBtn}
                                onClick={handleShare}
                                disabled={sharing}
                            >
                                <span
                                    style={{
                                        ...styles.actionIcon,
                                        color: "var(--color-text-secondary)",
                                    }}
                                >
                                    ↗
                                </span>
                                <span style={styles.actionLabel}>Share desc</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

// ── JoinCodeModal ─────────────────────────────────────────────────────────────

interface JoinCodeModalProps {
    joinCode: string;
    onDismiss: () => void;
}

function JoinCodeModal({ joinCode, onDismiss }: JoinCodeModalProps) {
    // Format as ABC-123 (visual only)
    const formatted =
        joinCode.length >= 6 ? `${joinCode.slice(0, 3)}-${joinCode.slice(3)}` : joinCode;

    return (
        <div style={styles.overlayBackdrop} onClick={onDismiss}>
            <div style={styles.joinCodeModal} onClick={(e) => e.stopPropagation()}>
                <button style={styles.joinCodeClose} onClick={onDismiss} aria-label="Close">
                    ×
                </button>
                <p style={styles.joinCodeLabel}>INVITE CODE</p>
                <p style={styles.joinCodeDisplay}>{formatted}</p>
                <p style={styles.joinCodeSub}>Share this code to invite players</p>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Game() {
    const history = useHistory();
    const {
        session,
        players,
        activePlayerId,
        devicePlayerIds,
        localPlayer,
        setActivePlayer,
        setSession,
    } = useSession();
    const { drawHistory, addDrawEvent, updateDrawEvent } = useCards();

    const [selectedCard, setSelectedCard] = useState<DrawEvent | null>(null);
    const [revealCard, setRevealCard] = useState<DrawEvent | null>(null);
    const [showJoinCode, setShowJoinCode] = useState(false);
    const [showResolved, setShowResolved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [drawPending, startDrawTransition] = useTransition();

    // Redirect if no session
    useEffect(() => {
        if (!session) {
            history.replace("/");
        }
    }, [session, history]);

    // Auto-show join code for host on first load
    const joinCodeShownRef = useRef(false);
    useEffect(() => {
        if (
            session &&
            localPlayer?.id === session.hostPlayerId &&
            drawHistory.length === 0 &&
            !joinCodeShownRef.current
        ) {
            joinCodeShownRef.current = true;
            setShowJoinCode(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // Session polling
    useEffect(() => {
        if (!session) return;
        const intervalId = setInterval(async () => {
            const result = await apiClient.getSessionState(session.id);
            if (!result.ok) return;
            setSession(result.data);
            for (const event of result.data.drawEvents ?? []) {
                if (event.revealedToAllAt !== null) addDrawEvent(event);
                else updateDrawEvent(event);
            }
        }, 5000);
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    // Active player derivation
    const activePlayer = players.find((p) => p.id === activePlayerId) ?? null;
    const isActivePlayerOnDevice = devicePlayerIds.includes(activePlayerId ?? "");

    // Card stack derivation
    const playerCards = drawHistory.filter((e) => e.playerId === activePlayerId);
    const activeCards = playerCards
        .filter((e) => !e.resolved)
        .sort((a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime());
    const resolvedCards = playerCards
        .filter((e) => e.resolved)
        .sort((a, b) => new Date(b.drawnAt).getTime() - new Date(a.drawnAt).getTime());
    const displayCards = showResolved ? [...activeCards, ...resolvedCards] : activeCards;

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleDraw() {
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
            setRevealCard(result.data);
        });
    }

    async function handleVote(cardId: string, direction: "up" | "down") {
        await apiClient.voteCard(cardId, direction);
    }

    async function handleResolve(drawEventId: string) {
        const result = await apiClient.resolveCard(drawEventId);
        if (result.ok) updateDrawEvent(result.data);
    }

    async function handleTransfer(drawEventId: string, toPlayerId: string) {
        await apiClient.createTransfer(drawEventId, toPlayerId);
    }

    async function handleShareDescription(drawEventId: string) {
        const result = await apiClient.shareDescription(drawEventId);
        if (result.ok) {
            updateDrawEvent(result.data);
            if (selectedCard?.id === drawEventId) setSelectedCard(result.data);
        }
    }

    if (!session) return null;

    return (
        <IonPage>
            <GameHeader
                sessionName={session.name}
                onJoinCode={() => setShowJoinCode(true)}
                players={players}
                devicePlayerIds={devicePlayerIds}
                activePlayerId={activePlayerId}
                onSwitchPlayer={setActivePlayer}
            />

            <IonContent scrollY>
                {/* Card stack */}
                <div style={styles.contentArea}>
                    <CardStack
                        events={displayCards}
                        players={players}
                        activePlayerId={activePlayerId}
                        showResolved={showResolved}
                        onCardTap={(event) => {
                            hapticLight();
                            setSelectedCard(event);
                        }}
                        onToggleResolved={() => setShowResolved((v) => !v)}
                        resolvedCount={resolvedCards.length}
                    />

                    {/* Active player name when not own cards */}
                    {activePlayer && (
                        <p style={styles.viewingLabel}>
                            {activePlayer.id === localPlayer?.id
                                ? "Your cards"
                                : `${activePlayer.displayName}'s cards`}
                        </p>
                    )}

                    {error && (
                        <p style={styles.error}>
                            {error}{" "}
                            <button style={styles.retryLink} onClick={handleDraw}>
                                Try again
                            </button>
                        </p>
                    )}
                </div>
            </IonContent>

            {/* Draw button footer */}
            <IonFooter>
                <div style={styles.footer}>
                    <DrawButton
                        isEnabled={isActivePlayerOnDevice && !drawPending}
                        isPending={drawPending}
                        onDraw={handleDraw}
                    />
                </div>
            </IonFooter>

            {/* Overlays */}
            {revealCard && (
                <CardRevealOverlay
                    event={revealCard}
                    onDismiss={() => setRevealCard(null)}
                />
            )}

            {selectedCard && !revealCard && (
                <CardDetailOverlay
                    event={selectedCard}
                    players={players}
                    activePlayerId={activePlayerId}
                    onDismiss={() => setSelectedCard(null)}
                    onVote={handleVote}
                    onResolve={handleResolve}
                    onTransfer={handleTransfer}
                    onShareDescription={handleShareDescription}
                    allPlayers={players}
                />
            )}

            {showJoinCode && (
                <JoinCodeModal
                    joinCode={session.joinCode}
                    onDismiss={() => setShowJoinCode(false)}
                />
            )}
        </IonPage>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    // Header
    toolbar: {
        "--background": "var(--color-surface)",
        "--border-color": "var(--color-border)",
        "--padding-start": "0",
        "--padding-end": "0",
    } as React.CSSProperties,
    headerInner: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--space-3)",
        height: "56px",
    },
    menuButton: {
        color: "var(--color-text-secondary)",
        "--color": "var(--color-text-secondary)",
    } as React.CSSProperties,
    sessionName: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
        flex: 1,
        textAlign: "center",
    },
    joinCodeButton: {
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "var(--space-2)",
        minWidth: "44px",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    joinCodeIcon: {
        fontSize: "20px",
        color: "var(--color-text-secondary)",
    },

    // Player switcher (rendered inside IonHeader — never scrolls)
    switcherWrap: {
        backgroundColor: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
    },
    switcherStrip: {
        display: "flex",
        flexDirection: "row",
        overflowX: "auto",
        gap: "var(--space-2)",
        padding: "var(--space-3) var(--space-4)",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
    },
    pillActive: {
        background: "var(--color-accent-primary)",
        border: "none",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        padding: "var(--space-2) var(--space-3)",
        height: "40px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 180ms var(--ease)",
        minWidth: "44px",
    },
    pillInactive: {
        background: "var(--color-surface-elevated)",
        border: "none",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 400,
        padding: "var(--space-2) var(--space-3)",
        height: "32px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 180ms var(--ease)",
        minWidth: "44px",
    },
    pillAdd: {
        background: "var(--color-surface-elevated)",
        border: "1px dashed var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        width: "32px",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "default",
        flexShrink: 0,
        opacity: 0.5,
    },

    // Card stack
    contentArea: {
        padding: "var(--space-5)",
        paddingBottom: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
    },
    stackOuter: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    showResolvedToggle: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-amber)",
        cursor: "pointer",
        padding: "var(--space-1) 0",
        textAlign: "left",
        minHeight: "44px",
    },
    stack: {
        display: "flex",
        flexDirection: "column",
        position: "relative",
    },

    // Card wrapper
    cardWrapper: {
        cursor: "pointer",
        position: "relative",
    },
    card: {
        background: "var(--color-surface)",
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
        position: "relative",
        overflow: "hidden",
    },
    cardContent: {
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    cardTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
    },
    cardPlayerChip: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    cornerDiamond: {
        position: "absolute",
        fontSize: 10,
        color: "var(--color-border)",
        lineHeight: 1,
        pointerEvents: "none",
    },
    resolvedOverlay: {
        position: "absolute",
        inset: 0,
        background: "color-mix(in srgb, var(--color-accent-amber) 20%, transparent)",
        pointerEvents: "none",
        zIndex: 1,
    },
    resolvedBadge: {
        position: "absolute",
        top: "var(--space-3)",
        right: "var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-accent-amber)",
        letterSpacing: "0.15em",
        zIndex: 2,
    },
    hiddenBadge: {
        position: "absolute",
        bottom: "var(--space-3)",
        right: "var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
        background: "var(--color-surface-elevated)",
        padding: "2px var(--space-2)",
    },

    // Empty state
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-12) var(--space-5)",
        gap: "var(--space-3)",
    },
    emptyLogo: {
        fontFamily: "var(--font-display)",
        fontSize: "64px",
        fontWeight: 700,
        color: "var(--color-border)",
        lineHeight: 1,
        letterSpacing: "-0.02em",
    },
    emptyTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
        textAlign: "center",
    },
    emptyHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        textAlign: "center",
        opacity: 0.6,
    },

    // Draw button footer
    footer: {
        backgroundColor: "var(--color-bg)",
        borderTop: "1px solid var(--color-border)",
        padding: "var(--space-4)",
        paddingBottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
    },
    drawButton: {
        width: "100%",
        height: "56px",
        background: "var(--color-surface)",
        border: "1.5px solid",
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-label)",
        fontWeight: 700,
        letterSpacing: "0.15em",
        transition: "border-color 220ms var(--ease), color 220ms var(--ease)",
    },

    // Viewing label
    viewingLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        textAlign: "center",
        letterSpacing: "0.05em",
    },

    // Error
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
        textAlign: "center",
    },
    retryLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
        textDecoration: "underline",
    },

    // Overlays — shared
    overlayBackdrop: {
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "color-mix(in srgb, var(--color-bg) 97%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-5)",
    },

    // CardRevealOverlay
    revealCardWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-4)",
        width: "100%",
        maxWidth: "430px",
        animation: "cardDeal 380ms var(--ease) forwards",
    },
    revealTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "28px",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: 2,
        overflow: "hidden",
        textOverflow: "ellipsis",
    } as React.CSSProperties,
    revealPlayerChip: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    revealDescription: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        lineHeight: 1.5,
        margin: 0,
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        paddingRight: "8px",
        scrollBehavior: "smooth",
        WebkitOverflowScrolling: "touch",
        display: "block",
    } as React.CSSProperties & {
        scrollbarWidth?: string;
        scrollbarColor?: string;
    },
    hiddenDescArea: {
        background:
            "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-border) 30%, transparent) 0px, color-mix(in srgb, var(--color-border) 30%, transparent) 1px, transparent 1px, transparent 8px)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-5)",
        cursor: "pointer",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    hiddenDescLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        letterSpacing: "0.05em",
    },
    shareDescBtn: {
        background: "none",
        border: "1px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-2) var(--space-4)",
        cursor: "pointer",
        alignSelf: "flex-start",
        minHeight: "44px",
    },
    revealDismissHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        opacity: 0.5,
        margin: 0,
        textAlign: "center",
    },

    // CardDetailOverlay
    detailWrap: {
        position: "fixed",
        inset: 0,
        zIndex: 101,
        backgroundColor: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
    },
    detailBack: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: "var(--space-4) var(--space-5)",
        paddingTop: "calc(var(--space-4) + env(safe-area-inset-top))",
        textAlign: "left",
        minHeight: "44px",
        alignSelf: "flex-start",
    },
    detailScroll: {
        flex: 1,
        overflowY: "auto",
        padding: "0 var(--space-5) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
    },
    detailCard: {
        background: "var(--color-surface)",
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
        boxShadow: "inset 0 0 0 1px var(--color-border)",
        position: "relative",
        overflow: "hidden",
    },
    detailCardContent: {
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
    },

    // Transfer picker
    transferPicker: {
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    transferPickerLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
        margin: 0,
    },
    transferPlayerBtn: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        padding: "var(--space-3) var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        minHeight: "44px",
    },
    transferCancelBtn: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "var(--space-2) 0",
        textAlign: "left",
        minHeight: "44px",
    },

    // Action bar
    actionBar: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-around",
        borderTop: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
        padding: "var(--space-3) var(--space-2)",
        paddingBottom: "calc(var(--space-3) + env(safe-area-inset-bottom))",
    },
    actionBtn: {
        background: "none",
        border: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-1)",
        cursor: "pointer",
        minWidth: "44px",
        minHeight: "44px",
        justifyContent: "center",
        padding: "0 var(--space-2)",
    },
    actionIcon: {
        fontSize: "20px",
        lineHeight: 1,
    },
    actionLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.05em",
    },

    // JoinCodeModal
    joinCodeModal: {
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-accent-amber)",
        padding: "var(--space-8) var(--space-6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-4)",
        position: "relative",
        maxWidth: "320px",
        width: "100%",
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
    },
    joinCodeClose: {
        position: "absolute",
        top: "var(--space-3)",
        right: "var(--space-3)",
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "20px",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        minWidth: "44px",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    joinCodeLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
        margin: 0,
    },
    joinCodeDisplay: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-display)",
        fontWeight: 700,
        color: "var(--color-accent-amber)",
        letterSpacing: "0.08em",
        margin: 0,
    },
    joinCodeSub: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        textAlign: "center",
    },
};
