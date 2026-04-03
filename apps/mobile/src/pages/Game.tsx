import {
    IonActionSheet,
    IonContent,
    IonFooter,
    IonHeader,
    IonMenuButton,
    IonPage,
    IonToolbar,
} from "@ionic/react";
import { Carousel } from "@mantine/carousel";
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useCards } from "../cards/useCards";
import { LoginForm } from "../components/LoginForm";
import type { DrawEvent, Player, Session } from "../lib/api";
import { apiClient } from "../lib/api";
import { hapticLight, hapticMedium } from "../lib/haptics";
import { playerTokenStore } from "../lib/playerTokenStore";
import { SCROLLBAR_CSS, SCROLLBAR_CLASS, SCROLLBAR_FIREFOX_STYLES } from "../lib/scrollbars";
import { useSession } from "../session/useSession";
import { CardFront, FlippingCard } from "../components/GameCard";
import { useExitSession } from "../session/useExitSession";
import { useTransfers } from "../transfers/useTransfers";
import { AppDialog } from "../components/AppDialog";

// ─── Draw Drama ──────────────────────────────────────────────────────────────

interface DrawDrama {
    /** Sound to loop from overlay mount until hitSoundAt */
    loopSound: string;
    /** One-shot sound fired at hitSoundAt ms */
    hitSound: string;
    /** ms from overlay mount when loop stops and hit sound fires */
    hitSoundAt: number;
    /** ms to show card back (static) before the flip begins */
    backMs: number;
    /** flip animation duration ms (passed as overrideDuration to FlippingCard) */
    flipMs: number;
    /** Optional label badge shown during the back phase (e.g. "GAME CHANGER") */
    preFlipLabel?: string;
}

const STANDARD_DRAW_DRAMA: DrawDrama = {
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    hitSoundAt: 500 + 2000 * 0.75, // 2000ms from mount
    backMs: 500,
    flipMs: 2000,
};

const GAME_CHANGER_DRAMA: DrawDrama = {
    loopSound: "/sound/drama.mp3",
    hitSound: "/sound/cymbal.mp3",
    hitSoundAt: 1500 + 3000 * 0.75, // 3750ms from mount
    backMs: 1500,
    flipMs: 3000,
    preFlipLabel: "GAME CHANGER",
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useIsLandscape(): boolean {
    const get = () => typeof window !== "undefined" && window.innerWidth > window.innerHeight;
    const [landscape, setLandscape] = useState(get);
    useEffect(() => {
        const handler = () => setLandscape(get());
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);
    return landscape;
}

function getInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
    return name.trim()[0]!.toUpperCase();
}

function suppressContextMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
}

function useLongPress(onLongPress: () => void, ms = 520) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didLongPress = useRef(false);

    const cancel = () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    };

    return {
        didLongPress,
        onPointerDown: () => {
            cancel();
            didLongPress.current = false;
            timer.current = setTimeout(() => {
                didLongPress.current = true;
                onLongPress();
            }, ms);
        },
        onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
            cancel();
            if (didLongPress.current) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        onPointerLeave: cancel,
        onPointerCancel: cancel,
    };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface DevicePlayerPillProps {
    player: Player;
    isActive: boolean;
    isHost: boolean;
    hasNotification: boolean;
    onSwitch: (id: string) => void;
    onLongPress: (player: Player) => void;
}

function DevicePlayerPill({
    player,
    isActive,
    isHost,
    hasNotification,
    onSwitch,
    onLongPress,
}: DevicePlayerPillProps) {
    const longPress = useLongPress(() => onLongPress(player));
    return (
        <div style={{ position: "relative", display: "inline-flex" }}>
            <button
                style={isActive ? styles.pillActive : styles.pillInactive}
                className={isActive ? undefined : "pill-inactive"}
                onContextMenuCapture={suppressContextMenu}
                onContextMenu={suppressContextMenu}
                onClick={(event) => {
                    if (longPress.didLongPress.current) {
                        event.preventDefault();
                        event.stopPropagation();
                        longPress.didLongPress.current = false;
                        return;
                    }
                    hapticLight();
                    onSwitch(player.id);
                }}
                aria-pressed={isActive}
                {...(isHost ? {} : longPress)}
            >
                <span style={isActive ? styles.avatarActive : styles.avatarInactive}>
                    {getInitials(player.displayName)}
                </span>
                <span style={styles.pillName}>{player.displayName}</span>
            </button>
            {hasNotification && (
                <span
                    style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--color-accent-amber)",
                        border: "1.5px solid var(--color-bg)",
                        pointerEvents: "none",
                    }}
                />
            )}
        </div>
    );
}

interface GameHeaderProps {
    sessionName: string;
    onJoinCode: () => void;
    players: Player[];
    devicePlayerIds: string[];
    activePlayerId: string | null;
    hostPlayerId: string;
    onSwitchPlayer: (playerId: string) => void;
    onAddPlayer: () => void;
    onLongPressPlayer: (player: Player) => void;
}

function GameHeader({
    sessionName,
    onJoinCode,
    players,
    devicePlayerIds,
    activePlayerId,
    hostPlayerId,
    onSwitchPlayer,
    onAddPlayer,
    onLongPressPlayer,
}: GameHeaderProps) {
    const { pendingTransfers } = useTransfers();
    const activeDevicePlayers = players
        .filter((p) => devicePlayerIds.includes(p.id) && p.active)
        .sort((a, b) => {
            // Registered user's player always first — stays stable even after a mid-session claim
            if (a.userId !== null && b.userId === null) return -1;
            if (a.userId === null && b.userId !== null) return 1;
            return 0;
        });
    const leftDevicePlayers = players.filter((p) => devicePlayerIds.includes(p.id) && !p.active);

    return (
        <>
            <style>{SCROLLBAR_CSS}</style>
            <style>{`
                .pill-inactive:not(:disabled):hover {
                    border-color: color-mix(in srgb, var(--color-accent-primary) 70%, transparent) !important;
                    color: var(--color-text-primary) !important;
                    opacity: 1 !important;
                }
                .pill-add:not(:disabled):hover {
                    background: color-mix(in srgb, var(--color-accent-primary) 15%, transparent) !important;
                    border-color: var(--color-accent-primary) !important;
                    border-style: solid !important;
                    opacity: 1 !important;
                }
                .pill-non-device:not(:disabled):hover {
                    opacity: 0.9 !important;
                    border-style: solid !important;
                }
                .pill-left:not(:disabled):hover {
                    opacity: 0.65 !important;
                }
                .pill-inactive:active, .pill-non-device:active, .pill-left:active {
                    transform: scale(0.94) !important;
                }
                .pill-add:active {
                    transform: scale(0.92) !important;
                }
            `}</style>
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
                    <div
                        style={{ ...styles.switcherStrip, ...SCROLLBAR_FIREFOX_STYLES }}
                        className={SCROLLBAR_CLASS}
                    >
                        {/* Active device players */}
                        {activeDevicePlayers.map((p) => (
                            <DevicePlayerPill
                                key={p.id}
                                player={p}
                                isActive={p.id === activePlayerId}
                                isHost={p.id === hostPlayerId}
                                hasNotification={pendingTransfers.some(
                                    (t) => t.toPlayerId === p.id
                                )}
                                onSwitch={onSwitchPlayer}
                                onLongPress={onLongPressPlayer}
                            />
                        ))}

                        {/* Add player button — hidden at 4 active device players */}
                        {activeDevicePlayers.length < 4 && (
                            <button
                                style={styles.pillAdd}
                                className="pill-add"
                                onContextMenuCapture={suppressContextMenu}
                                onContextMenu={suppressContextMenu}
                                onClick={() => {
                                    hapticLight();
                                    onAddPlayer();
                                }}
                                aria-label="Add player to this device"
                            >
                                +
                            </button>
                        )}

                        {/* Left device players (inactive, still viewable) */}
                        {leftDevicePlayers.map((p) => {
                            const isActive = p.id === activePlayerId;
                            return (
                                <button
                                    key={p.id}
                                    style={isActive ? styles.pillLeftActive : styles.pillLeft}
                                    className={isActive ? undefined : "pill-left"}
                                    onContextMenuCapture={suppressContextMenu}
                                    onContextMenu={suppressContextMenu}
                                    onClick={() => {
                                        hapticLight();
                                        onSwitchPlayer(p.id);
                                    }}
                                    aria-pressed={isActive}
                                >
                                    <span
                                        style={
                                            isActive ? styles.avatarLeftActive : styles.avatarLeft
                                        }
                                    >
                                        {getInitials(p.displayName)}
                                    </span>
                                    <span style={styles.pillName}>{p.displayName}</span>
                                </button>
                            );
                        })}

                        {/* Non-device players (on other phones) */}
                        {players
                            .filter((p) => !devicePlayerIds.includes(p.id) && p.active)
                            .map((p) => {
                                const isActive = p.id === activePlayerId;
                                return (
                                    <button
                                        key={p.id}
                                        style={
                                            isActive
                                                ? styles.pillNonDeviceActive
                                                : styles.pillNonDevice
                                        }
                                        className={isActive ? undefined : "pill-non-device"}
                                        onContextMenuCapture={suppressContextMenu}
                                        onContextMenu={suppressContextMenu}
                                        onClick={() => {
                                            hapticLight();
                                            onSwitchPlayer(p.id);
                                        }}
                                        aria-pressed={isActive}
                                    >
                                        <span
                                            style={
                                                isActive
                                                    ? styles.avatarNonDeviceActive
                                                    : styles.avatarNonDevice
                                            }
                                        >
                                            {getInitials(p.displayName)}
                                        </span>
                                        <span style={styles.pillName}>{p.displayName}</span>
                                    </button>
                                );
                            })}
                    </div>
                </div>
                {/* Viewing banner — shown when viewing a left or non-device player */}
                {(() => {
                    const viewed = players.find((p) => p.id === activePlayerId);
                    if (!viewed) return null;
                    const isRemote = !devicePlayerIds.includes(viewed.id);
                    const isLeft = devicePlayerIds.includes(viewed.id) && !viewed.active;
                    if (!isRemote && !isLeft) return null;
                    return (
                        <div style={styles.viewingBanner}>
                            Viewing {viewed.displayName}'s hand{isLeft ? " · left" : ""}
                        </div>
                    );
                })()}
            </IonHeader>
        </>
    );
}

// ── AddPlayerModal ────────────────────────────────────────────────────────────

interface AddPlayerModalProps {
    session: Session;
    onClose: () => void;
    onSuccess: (playerId: string) => void;
}

function AddPlayerModal({ session, onClose, onSuccess }: AddPlayerModalProps) {
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const trimmed = name.trim();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!trimmed || pending) return;
        setError(null);
        startTransition(async () => {
            const savedToken = await playerTokenStore.get(session.joinCode, trimmed);
            const result = await apiClient.joinByCode({
                joinCode: session.joinCode,
                displayName: trimmed,
                playerToken: savedToken,
            });
            if (!result.ok) {
                const code = result.error.code;
                if (code === "CONFLICT_ERROR") {
                    setError("That name is in use on another device.");
                } else if (code === "AUTHENTICATION_ERROR") {
                    setError(
                        "This name belongs to a registered player. Ask them to join from their own device."
                    );
                } else {
                    setError(result.error.message);
                }
                return;
            }
            const { player, playerToken } = result.data;
            if (playerToken) {
                playerTokenStore.set(session.joinCode, trimmed, playerToken);
            }
            onSuccess(player.id);
        });
    }

    return (
        <div style={styles.overlayBackdrop} onClick={onClose}>
            <div style={styles.addPlayerSheet} onClick={(e) => e.stopPropagation()}>
                <p style={styles.addPlayerTitle}>Add player to this device</p>
                <p style={styles.addPlayerHint}>
                    Enter a display name. They'll take turns on this device.
                </p>
                <form onSubmit={handleSubmit} style={styles.addPlayerForm}>
                    <input
                        style={styles.addPlayerInput}
                        type="text"
                        placeholder="Display name"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setError(null);
                        }}
                        autoFocus
                        maxLength={32}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="words"
                        spellCheck={false}
                    />
                    {error && <p style={styles.addPlayerError}>{error}</p>}
                    <div style={styles.addPlayerActions}>
                        <button type="button" style={styles.addPlayerCancel} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                ...styles.addPlayerJoin,
                                opacity: trimmed && !pending ? 1 : 0.45,
                            }}
                            disabled={!trimmed || pending}
                        >
                            {pending ? "Joining…" : "Join"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── CardCarousel ──────────────────────────────────────────────────────────────

interface CardCarouselProps {
    events: DrawEvent[];
    onCardTap: (event: DrawEvent) => void;
    viewingPlayerName?: string | null;
}

function CardCarousel({
    events,
    onCardTap,
    viewingPlayerName,
}: CardCarouselProps) {
    const isLandscape = useIsLandscape();

    if (events.length === 0) {
        return (
            <div style={styles.emptyState}>
                <div style={styles.emptyLogo}>C</div>
                <p style={styles.emptyTitle}>No cards drawn yet.</p>
                <p style={styles.emptyHint}>
                    {viewingPlayerName
                        ? `${viewingPlayerName} hasn't drawn yet.`
                        : "Tap Draw when it's your turn."}
                </p>
            </div>
        );
    }

    return (
        <div style={styles.carouselOuter}>
            <Carousel
                key={isLandscape ? "landscape" : "portrait"}
                withControls={false}
                withIndicators={events.length > 1}
                slideSize={isLandscape ? "25%" : "100%"}
                slideGap="12px"
                styles={{
                    indicators: { bottom: -20, gap: "6px" },
                }}
            >
                {events.map((event) => (
                    <Carousel.Slide key={event.id}>
                        <div
                            style={{
                                // Cap width so card height never exceeds 65dvh (portrait or landscape).
                                // 412/581 is the card aspect ratio; at max height, width = 65dvh * (412/581).
                                maxWidth: "calc(65dvh * 412 / 581)",
                                margin: "0 auto",
                                opacity: event.resolved ? 0.55 : undefined,
                                cursor: "pointer",
                            }}
                            onClick={() => onCardTap(event)}
                        >
                            <CardFront event={event} readOnly />
                        </div>
                    </Carousel.Slide>
                ))}
            </Carousel>
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
    drama?: DrawDrama;
}

function CardRevealOverlay({ event, onDismiss, drama }: CardRevealOverlayProps) {
    const loopRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!drama) return;

        const loop = new Audio(drama.loopSound);
        loop.loop = true;
        loop.play().catch(() => {});
        loopRef.current = loop;

        const hitTimer = window.setTimeout(() => {
            loopRef.current?.pause();
            loopRef.current = null;
            new Audio(drama.hitSound).play().catch(() => {});
        }, drama.hitSoundAt);

        return () => {
            window.clearTimeout(hitTimer);
            loopRef.current?.pause();
            loopRef.current = null;
        };
    }, [drama]);

    return (
        <div style={styles.overlayBackdrop} onClick={onDismiss}>
            <div style={{ ...styles.revealCardWrap, position: "relative" }} onClick={(e) => e.stopPropagation()}>
                {drama?.preFlipLabel && (
                    <div style={styles.preFlipBadge}>{drama.preFlipLabel}</div>
                )}
                <FlippingCard
                    event={event}
                    dramaDelayMs={drama?.backMs}
                    overrideDuration={drama?.flipMs}
                />
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
    pendingTransfer: import("../lib/api").CardTransfer | null;
    onDismiss: () => void;
    onVote: (cardId: string, direction: "up" | "down" | null) => Promise<void>;
    onResolve: (drawEventId: string, resolved: boolean) => Promise<void>;
    onTransfer: (drawEventId: string, toPlayerId: string) => Promise<void>;
    onCancelTransfer: (transferId: string) => Promise<void>;
    onShareDescription: (drawEventId: string) => Promise<void>;
    allPlayers: Player[];
}

function CardDetailOverlay({
    event,
    players: _players,
    activePlayerId,
    pendingTransfer,
    onDismiss,
    onVote,
    onResolve,
    onTransfer,
    onCancelTransfer,
    onShareDescription,
    allPlayers,
}: CardDetailOverlayProps) {
    const cv = event.cardVersion;
    const isDrawer = event.playerId === activePlayerId;
    const [voteDir, setVoteDir] = useState<"up" | "down" | null>(null);
    const [resolvePending, setResolvePending] = useState(false);
    const [showTransferPicker, setShowTransferPicker] = useState(false);
    // confirmTransfer: holds the chosen target until user confirms in the dialog
    const [confirmTransfer, setConfirmTransfer] = useState<{
        toPlayerId: string;
        toPlayerName: string;
    } | null>(null);
    const [sharing, setSharing] = useState(false);
    const [sharedViaActionBar, setSharedViaActionBar] = useState(event.descriptionShared);

    const showActionBarShareBtn = cv.hiddenDescription && !sharedViaActionBar && isDrawer;

    // Current transfer target name (for retract confirmation)
    const pendingTargetName =
        allPlayers.find((p) => p.id === pendingTransfer?.toPlayerId)?.displayName ?? "player";

    async function handleVote(dir: "up" | "down") {
        const next = voteDir === dir ? null : dir;
        setVoteDir(next);
        hapticLight();
        await onVote(cv.cardId, next);
    }

    async function handleResolve() {
        setResolvePending(true);
        hapticLight();
        await onResolve(event.id, !event.resolved);
        setResolvePending(false);
    }

    function handlePickTransferTarget(toPlayerId: string, toPlayerName: string) {
        setShowTransferPicker(false);
        setConfirmTransfer({ toPlayerId, toPlayerName });
    }

    async function handleConfirmTransfer() {
        if (!confirmTransfer) return;
        const { toPlayerId } = confirmTransfer;
        setConfirmTransfer(null);
        hapticLight();
        await onTransfer(event.id, toPlayerId);
    }

    async function handleConfirmRetract() {
        if (!pendingTransfer) return;
        setConfirmTransfer(null);
        hapticLight();
        await onCancelTransfer(pendingTransfer.id);
    }

    async function handleShare() {
        setSharing(true);
        hapticLight();
        await onShareDescription(event.id);
        setSharedViaActionBar(true);
        setSharing(false);
    }

    const transferablePlayers = allPlayers.filter((p) => p.id !== event.playerId && p.active);

    // Confirmation dialog state — retract vs. new transfer
    const [showRetractConfirm, setShowRetractConfirm] = useState(false);

    return (
        <div style={styles.detailWrap} onClick={onDismiss}>
            {/* Card with fast flip */}
            <div style={styles.detailCardArea}>
                <div
                    style={{ maxWidth: "430px", width: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <FlippingCard event={event} overrideDuration={480} />
                </div>
            </div>

            {/* Transfer player picker */}
            {showTransferPicker && (
                <div style={styles.transferPicker} onClick={(e) => e.stopPropagation()}>
                    <p style={styles.transferPickerLabel}>TRANSFER TO</p>
                    {transferablePlayers.map((p) => (
                        <button
                            key={p.id}
                            style={styles.transferPlayerBtn}
                            onClick={() => handlePickTransferTarget(p.id, p.displayName)}
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

            {/* New-transfer confirmation dialog */}
            {confirmTransfer && (
                <AppDialog
                    title={
                        pendingTransfer
                            ? `Cancel offer to ${pendingTargetName}?`
                            : `Offer to ${confirmTransfer.toPlayerName}?`
                    }
                    message={
                        pendingTransfer
                            ? `Your pending offer to ${pendingTargetName} will be cancelled. Offer "${cv.title}" to ${confirmTransfer.toPlayerName} instead?`
                            : `Offer "${cv.title}" to ${confirmTransfer.toPlayerName}?`
                    }
                    onDismiss={() => setConfirmTransfer(null)}
                    buttons={[
                        {
                            label: "Cancel",
                            variant: "ghost",
                            onClick: () => setConfirmTransfer(null),
                        },
                        {
                            label: pendingTransfer ? "Re-offer" : "Offer",
                            variant: "accent",
                            onClick: handleConfirmTransfer,
                        },
                    ]}
                />
            )}

            {/* Retract confirmation dialog */}
            {showRetractConfirm && (
                <AppDialog
                    title="Retract offer?"
                    message={`Cancel your pending offer of "${cv.title}" to ${pendingTargetName}?`}
                    accent="danger"
                    onDismiss={() => setShowRetractConfirm(false)}
                    buttons={[
                        {
                            label: "Keep offer",
                            variant: "ghost",
                            onClick: () => setShowRetractConfirm(false),
                        },
                        {
                            label: "Retract",
                            variant: "danger",
                            onClick: async () => {
                                setShowRetractConfirm(false);
                                await handleConfirmRetract();
                            },
                        },
                    ]}
                />
            )}

            {/* Action bar */}
            <div style={styles.actionBar} onClick={(e) => e.stopPropagation()}>
                {/* Vote up */}
                <button style={styles.actionBtn} onClick={() => handleVote("up")}>
                    <span
                        style={{
                            ...styles.actionIcon,
                            color:
                                voteDir === "up"
                                    ? "var(--color-accent-amber)"
                                    : "var(--color-text-secondary)",
                        }}
                    >
                        ↑
                    </span>
                    <span style={styles.actionLabel}>Up</span>
                </button>

                {/* Vote down */}
                <button style={styles.actionBtn} onClick={() => handleVote("down")}>
                    <span
                        style={{
                            ...styles.actionIcon,
                            color:
                                voteDir === "down"
                                    ? "var(--color-danger)"
                                    : "var(--color-text-secondary)",
                        }}
                    >
                        ↓
                    </span>
                    <span style={styles.actionLabel}>Down</span>
                </button>

                {/* Resolve */}
                <button
                    style={styles.actionBtn}
                    onClick={handleResolve}
                    disabled={resolvePending}
                >
                    <span
                        style={{
                            ...styles.actionIcon,
                            color: event.resolved
                                ? "var(--color-success)"
                                : "var(--color-text-secondary)",
                        }}
                    >
                        ✓
                    </span>
                    <span style={styles.actionLabel}>
                        {event.resolved ? "Resolved" : "Resolve"}
                    </span>
                </button>

                {/* Transfer / Retract */}
                {pendingTransfer ? (
                    <button
                        style={styles.actionBtn}
                        onClick={() => setShowRetractConfirm(true)}
                    >
                        <span
                            style={{
                                ...styles.actionIcon,
                                color: "var(--color-accent-amber)",
                            }}
                        >
                            ⇄
                        </span>
                        <span style={{ ...styles.actionLabel, color: "var(--color-accent-amber)" }}>
                            Retract
                        </span>
                    </button>
                ) : (
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
                {showActionBarShareBtn && (
                    <button style={styles.actionBtn} onClick={handleShare} disabled={sharing}>
                        <span
                            style={{
                                ...styles.actionIcon,
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            ↗
                        </span>
                        <span style={styles.actionLabel}>
                            {sharing ? "Sharing..." : "Share desc"}
                        </span>
                    </button>
                )}
            </div>
        </div>
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

// ── ClaimAccountModal ────────────────────────────────────────────────────────

interface ClaimAccountModalProps {
    onClose: () => void;
}

function ClaimAccountModal({ onClose }: ClaimAccountModalProps) {
    return (
        <div style={styles.overlayBackdrop} onClick={onClose}>
            <div style={styles.addPlayerSheet} onClick={(e) => e.stopPropagation()}>
                <p style={styles.addPlayerTitle}>Log in to link your account</p>
                <p style={styles.addPlayerHint}>
                    Sign in to attach your player to a registered account. Your draws and votes will
                    be preserved.
                </p>
                <LoginForm onSuccess={onClose} onCancel={onClose} showNudge={false} />
            </div>
        </div>
    );
}

// Tracks which session IDs have already auto-shown the join code so navigation
// away and back does not trigger it again.
const joinCodeShownSessions = new Set<string>();

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Game() {
    const history = useHistory();
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
    const { drawHistory, addDrawEvent, updateDrawEvent, removeDrawEvent } = useCards();
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
    const [actionSheetTarget, setActionSheetTarget] = useState<Player | null>(null);
    const { isGuest, accessToken } = useAuth();

    useEffect(() => {
        if (!actionSheetTarget) return;

        const suppressActionSheetContextMenu = (event: Event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const isActionSheetTarget =
                target.closest("ion-action-sheet") !== null ||
                target.closest("ion-backdrop") !== null;
            if (!isActionSheetTarget) return;

            event.preventDefault();
            event.stopPropagation();
        };

        document.addEventListener("contextmenu", suppressActionSheetContextMenu, true);
        return () => {
            document.removeEventListener("contextmenu", suppressActionSheetContextMenu, true);
        };
    }, [actionSheetTarget]);

    // Redirect if no session
    useEffect(() => {
        if (!session) {
            history.replace("/");
        }
    }, [session, history]);

    // Auto-show join code for host only the first time they enter this session
    useEffect(() => {
        if (
            session &&
            localPlayer?.id === session.hostPlayerId &&
            drawHistory.length === 0 &&
            !joinCodeShownSessions.has(session.id)
        ) {
            joinCodeShownSessions.add(session.id);
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
            // Sync pending transfers — filter to transfers involving this device's players
            const relevant = (result.data.pendingTransfers ?? []).filter(
                (t) =>
                    devicePlayerIds.includes(t.fromPlayerId) ||
                    devicePlayerIds.includes(t.toPlayerId)
            );
            setPendingTransfers(relevant);
        }, 5000);
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
            setRevealDrama(prefersReduced ? null : isGameChanger ? GAME_CHANGER_DRAMA : STANDARD_DRAW_DRAMA);
            setRevealCard(result.data);
        });
    }, [activePlayerId, addDrawEvent, session, startDrawTransition]);

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
        async (drawEventId: string) => {
            const result = await apiClient.shareDescription(drawEventId);
            if (result.ok) {
                updateDrawEvent(result.data);
                if (selectedCard?.id === drawEventId) setSelectedCard(result.data);
            }
        },
        [selectedCard, updateDrawEvent]
    );

    const handleLeaveOrRemove = useCallback(async () => {
        if (!actionSheetTarget || !session) return;
        const hasCards = drawHistory.some((e) => e.playerId === actionSheetTarget.id);
        await apiClient.leaveSession(session.id, actionSheetTarget.id);
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

    if (!session) return null;

    return (
        <IonPage>
            <GameHeader
                sessionName={session.name}
                onJoinCode={() => setShowJoinCode(true)}
                players={players}
                devicePlayerIds={devicePlayerIds}
                activePlayerId={activePlayerId}
                hostPlayerId={session.hostPlayerId}
                onSwitchPlayer={setActivePlayer}
                onAddPlayer={() => setShowAddPlayer(true)}
                onLongPressPlayer={setActionSheetTarget}
            />

            <IonContent scrollY className="game-content">
                {/* Card stack */}
                <div style={styles.contentArea}>
                    <CardCarousel
                        events={displayCards}
                        onCardTap={(event) => {
                            hapticLight();
                            setSelectedCard(event);
                        }}
                        viewingPlayerName={(() => {
                            const p = players.find((pp) => pp.id === activePlayerId);
                            if (!p) return null;
                            const isLeft = devicePlayerIds.includes(p.id) && !p.active;
                            const isRemote = !devicePlayerIds.includes(p.id);
                            return isLeft || isRemote ? p.displayName : null;
                        })()}
                    />

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
                    {resolvedCards.length > 0 && (
                        <button
                            style={styles.resolvedToggle}
                            onClick={() => setShowResolved((v) => !v)}
                        >
                            {showResolved ? "Hide resolved" : `Show ${resolvedCards.length} resolved`}
                        </button>
                    )}
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
                    drama={revealDrama ?? undefined}
                    onDismiss={() => {
                        setRevealCard(null);
                        setRevealDrama(null);
                    }}
                />
            )}

            {selectedCard && !revealCard && (
                <CardDetailOverlay
                    event={selectedCard}
                    players={players}
                    activePlayerId={activePlayerId}
                    pendingTransfer={
                        pendingTransfers.find((t) => t.drawEventId === selectedCard.id) ?? null
                    }
                    onDismiss={() => setSelectedCard(null)}
                    onVote={handleVote}
                    onResolve={handleResolve}
                    onTransfer={handleTransfer}
                    onCancelTransfer={handleCancelTransfer}
                    onShareDescription={handleShareDescription}
                    allPlayers={players}
                />
            )}

            {showAddPlayer && (
                <AddPlayerModal
                    session={session}
                    onClose={() => setShowAddPlayer(false)}
                    onSuccess={(playerId) => {
                        addDevicePlayer(playerId);
                        setActivePlayer(playerId);
                        setShowAddPlayer(false);
                    }}
                />
            )}

            {showJoinCode && (
                <JoinCodeModal
                    joinCode={session.joinCode}
                    onDismiss={() => setShowJoinCode(false)}
                />
            )}

            {showClaim && <ClaimAccountModal onClose={() => setShowClaim(false)} />}

            <IonActionSheet
                isOpen={actionSheetTarget !== null}
                onDidDismiss={() => setActionSheetTarget(null)}
                header={actionSheetTarget?.displayName}
                buttons={[
                    ...(actionSheetTarget !== null &&
                    pendingTransfers.some((t) => t.toPlayerId === actionSheetTarget.id)
                        ? [
                              {
                                  text: "Notifications",
                                  handler: () => {
                                      history.push("/notifications");
                                      setActionSheetTarget(null);
                                  },
                              },
                          ]
                        : []),
                    ...(isGuest &&
                    !!accessToken &&
                    actionSheetTarget !== null &&
                    devicePlayerIds.includes(actionSheetTarget.id) &&
                    actionSheetTarget.userId === null
                        ? [
                              {
                                  text: "Log in to link account",
                                  handler: () => {
                                      setShowClaim(true);
                                      setActionSheetTarget(null);
                                  },
                              },
                          ]
                        : []),
                    ...(actionSheetTarget !== null &&
                    devicePlayerIds.includes(actionSheetTarget.id) &&
                    actionSheetTarget.id !== session?.hostPlayerId
                        ? [
                              {
                                  text: "Edit options",
                                  handler: () => {
                                      history.push(
                                          `/game-options/${session!.id}/${actionSheetTarget!.id}`
                                      );
                                      setActionSheetTarget(null);
                                  },
                              },
                          ]
                        : []),
                    {
                        text: drawHistory.some((e) => e.playerId === actionSheetTarget?.id)
                            ? "Leave game"
                            : "Remove from session",
                        role: "destructive",
                        handler: handleLeaveOrRemove,
                    },
                    { text: "Cancel", role: "cancel" },
                ]}
            />
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
        borderBottom: "1.5px solid var(--color-border)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
    },
    switcherStrip: {
        display: "flex",
        flexDirection: "row",
        overflowX: "auto",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        WebkitOverflowScrolling: "touch",
    },
    // ── Shared pill base ──────────────────────────────────────────────────────
    pillActive: {
        background: "var(--color-accent-primary)",
        border: "1.5px solid var(--color-accent-amber)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        letterSpacing: "0.01em",
        padding: "0 var(--space-4) 0 var(--space-2)",
        height: "44px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        animation: "playerTokenGlow 2.4s ease-in-out infinite",
        transition: "all 200ms var(--ease)",
        minWidth: "64px",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillInactive: {
        background: "var(--color-surface-elevated)",
        border: "1px solid color-mix(in srgb, var(--color-accent-primary) 35%, transparent)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 400,
        padding: "0 var(--space-3) 0 var(--space-2)",
        height: "40px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.85,
        transition: "all 200ms var(--ease)",
        minWidth: "52px",
        borderRadius: "5px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillNonDevice: {
        background:
            "color-mix(in srgb, var(--color-accent-amber) 7%, var(--color-surface-elevated))",
        border: "1px dashed color-mix(in srgb, var(--color-accent-amber) 70%, transparent)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 400,
        padding: "0 var(--space-3) 0 var(--space-2)",
        height: "40px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.65,
        transition: "all 200ms var(--ease)",
        minWidth: "52px",
        borderRadius: "5px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillNonDeviceActive: {
        background:
            "color-mix(in srgb, var(--color-accent-amber) 15%, var(--color-surface-elevated))",
        border: "1.5px solid var(--color-accent-amber)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        letterSpacing: "0.01em",
        padding: "0 var(--space-4) 0 var(--space-2)",
        height: "44px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 1,
        transition: "all 200ms var(--ease)",
        minWidth: "64px",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        boxShadow: "0 0 14px 3px rgba(212, 168, 71, 0.3), 0 2px 6px rgba(0,0,0,0.35)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillName: {
        fontFamily: '"Playfair Display", Georgia, serif',
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
    },
    // Avatar initials badges
    avatarActive: {
        width: "26px",
        height: "26px",
        borderRadius: "50%",
        background: "var(--color-accent-amber)",
        color: "var(--color-bg)",
        fontSize: "11px",
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
        lineHeight: 1,
    },
    avatarInactive: {
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--color-accent-primary) 28%, var(--color-surface))",
        color: "var(--color-text-secondary)",
        fontSize: "10px",
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
        lineHeight: 1,
    },
    avatarNonDevice: {
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--color-accent-amber) 22%, var(--color-surface))",
        color: "var(--color-accent-amber)",
        fontSize: "10px",
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
        lineHeight: 1,
    },
    avatarNonDeviceActive: {
        width: "26px",
        height: "26px",
        borderRadius: "50%",
        background: "var(--color-accent-amber)",
        color: "var(--color-bg)",
        fontSize: "11px",
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
        lineHeight: 1,
    },
    // Left (inactive) device player pills
    pillLeft: {
        background: "var(--color-surface)",
        border: "1px dashed color-mix(in srgb, var(--color-border) 80%, transparent)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 400,
        padding: "0 var(--space-3) 0 var(--space-2)",
        height: "36px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.45,
        transition: "all 200ms var(--ease)",
        minWidth: "52px",
        borderRadius: "5px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillLeftActive: {
        background: "color-mix(in srgb, var(--color-text-secondary) 8%, var(--color-surface))",
        border: "1px solid color-mix(in srgb, var(--color-border) 120%, transparent)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        padding: "0 var(--space-3) 0 var(--space-2)",
        height: "40px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.7,
        transition: "all 200ms var(--ease)",
        minWidth: "52px",
        borderRadius: "5px",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    avatarLeft: {
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--color-border) 60%, var(--color-surface))",
        color: "var(--color-text-secondary)",
        fontSize: "9px",
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
        lineHeight: 1,
    },
    avatarLeftActive: {
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--color-border) 80%, var(--color-surface))",
        color: "var(--color-text-secondary)",
        fontSize: "10px",
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: "0.02em",
        lineHeight: 1,
    },
    viewingBanner: {
        textAlign: "center",
        fontSize: "var(--text-caption)",
        fontFamily: "var(--font-ui)",
        color: "var(--color-accent-amber)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "var(--space-1) var(--space-4)",
        borderBottom: "1px solid color-mix(in srgb, var(--color-accent-amber) 20%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-accent-amber) 6%, transparent)",
    },
    pillAdd: {
        background: "transparent",
        border: "1.5px dashed color-mix(in srgb, var(--color-accent-primary) 55%, transparent)",
        color: "color-mix(in srgb, var(--color-accent-primary) 70%, transparent)",
        fontSize: "22px",
        fontWeight: 300,
        lineHeight: 1,
        width: "40px",
        height: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        borderRadius: "5px",
        transition: "all 200ms var(--ease)",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },

    // AddPlayerModal
    addPlayerSheet: {
        backgroundColor: "var(--color-surface)",
        clipPath:
            "polygon(10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0% calc(100% - 10px), 0% 10px)",
        boxShadow: "inset 0 0 0 1px var(--color-border)",
        width: "calc(100% - 2 * var(--space-5))",
        maxWidth: "380px",
        padding: "var(--space-6) var(--space-5) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    addPlayerTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        margin: 0,
        letterSpacing: "-0.02em",
    },
    addPlayerHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.4,
    },
    addPlayerForm: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    addPlayerInput: {
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        padding: "var(--space-3) var(--space-4)",
        width: "100%",
        outline: "none",
        boxSizing: "border-box" as const,
    },
    addPlayerError: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
    },
    addPlayerActions: {
        display: "flex",
        flexDirection: "row",
        gap: "var(--space-3)",
        marginTop: "var(--space-1)",
    },
    addPlayerCancel: {
        flex: 1,
        background: "none",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        padding: "var(--space-3)",
        cursor: "pointer",
        minHeight: "44px",
    },
    addPlayerJoin: {
        flex: 1,
        background: "var(--color-accent-amber)",
        border: "none",
        color: "var(--color-bg)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 600,
        padding: "var(--space-3)",
        cursor: "pointer",
        minHeight: "44px",
        transition: "opacity 150ms var(--ease)",
    },

    // Card carousel
    contentArea: {
        padding: "var(--space-5)",
        paddingBottom: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
    },
    carouselOuter: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        paddingBottom: "var(--space-6)",
    },
    resolvedToggle: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "0 0 var(--space-2) 0",
        textAlign: "center",
        width: "100%",
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
    preFlipBadge: {
        position: "absolute",
        top: "calc(var(--space-3) * -1)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 3,
        background: "var(--color-accent-amber)",
        color: "var(--color-bg)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 700,
        letterSpacing: "0.2em",
        padding: "6px var(--space-3)",
        boxShadow:
            "0 6px 14px -8px color-mix(in srgb, var(--color-accent-amber) 75%, transparent)",
        animation: "gameChangerBadgePulse 900ms ease-in-out infinite",
        whiteSpace: "nowrap" as const,
    },
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
        zIndex: 100,
        backgroundColor: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        cursor: "pointer",
    },
    detailCardArea: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-3) var(--space-5)",
        minHeight: 0,
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
