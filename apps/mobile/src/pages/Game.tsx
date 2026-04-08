import { MAX_DISPLAY_NAME_LENGTH } from "@chance/core";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useForm } from "react-hook-form";
import { useHistory, useLocation } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { useCards } from "../cards/useCards";
import { AppDialog } from "../components/AppDialog";
import { CardFront, FlippingCard } from "../components/GameCard";
import { LoginForm } from "../components/LoginForm";
import type { CardTransfer, DrawEvent, Player, Session } from "../lib/api";
import { apiClient } from "../lib/api";
import { hapticLight, hapticMedium } from "../lib/haptics";
import { playerTokenStore } from "../lib/playerTokenStore";
import { SCROLLBAR_CLASS, SCROLLBAR_CSS, SCROLLBAR_FIREFOX_STYLES } from "../lib/scrollbars";
import { useExitSession } from "../session/useExitSession";
import { useSession } from "../session/useSession";
import { useTransfers } from "../transfers/useTransfers";

// ─── Draw Drama ──────────────────────────────────────────────────────────────

interface DrawDrama {
    /** Sound to loop (standard) or play once before flip (introOnly) */
    loopSound: string;
    /** If true, loopSound plays once and flip waits for onended before starting */
    introOnly?: boolean;
    /** One-shot sound fired when flip completes */
    hitSound: string;
    /** ms to show card back (static) before the flip begins — ignored when introOnly */
    backMs: number;
    /** flip animation duration ms (passed as overrideDuration to FlippingCard) */
    flipMs: number;
    /** Optional label badge shown during the back phase (e.g. "GAME CHANGER") */
    preFlipLabel?: string;
}

// Preload all drama sounds at module load so they play without delay.
const preloadedAudio: Record<string, HTMLAudioElement> = {};
function preloadSound(src: string): void {
    if (typeof window === "undefined") return;
    const el = new Audio(src);
    el.preload = "auto";
    preloadedAudio[src] = el;
}
["/sound/drumrollloop.mp3", "/sound/drama.mp3", "/sound/cymbal.mp3"].forEach(preloadSound);

function getAudio(src: string): HTMLAudioElement {
    // Return a clone so the same sound can overlap / restart cleanly.
    const cached = preloadedAudio[src];
    if (cached) {
        const clone = cached.cloneNode() as HTMLAudioElement;
        return clone;
    }
    return new Audio(src);
}

const STANDARD_DRAW_DRAMA: DrawDrama = {
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    backMs: 750,
    flipMs: 1000,
};

const GAME_CHANGER_DRAMA: DrawDrama = {
    loopSound: "/sound/drama.mp3",
    introOnly: true,
    hitSound: "/sound/cymbal.mp3",
    backMs: 0, // unused — drama.mp3 duration drives the hold
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

// ─── Sub-components ──────────────────────────────────────────────────────────

interface DevicePlayerPillProps {
    player: Player;
    isActive: boolean;
    hasNotification: boolean;
    onSwitch: (id: string) => void;
    onAction: (player: Player) => void;
}

function DevicePlayerPill({
    player,
    isActive,
    hasNotification,
    onSwitch,
    onAction,
}: DevicePlayerPillProps) {
    return (
        <div style={{ position: "relative", display: "inline-flex" }}>
            <button
                style={isActive ? styles.pillActive : styles.pillInactive}
                className={isActive ? "pill-active" : "pill-inactive"}
                onClick={() => {
                    hapticLight();
                    if (isActive) {
                        onAction(player);
                    } else {
                        onSwitch(player.id);
                    }
                }}
                aria-pressed={isActive}
            >
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
    onSwitchPlayer: (playerId: string) => void;
    onAddPlayer: () => void;
    onActionPlayer: (player: Player) => void;
}

function GameHeader({
    sessionName,
    onJoinCode,
    players,
    devicePlayerIds,
    activePlayerId,
    onSwitchPlayer,
    onAddPlayer,
    onActionPlayer,
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
                    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-primary) 70%, transparent) !important;
                    color: var(--color-text-primary) !important;
                    opacity: 1 !important;
                }
                .pill-add:not(:disabled):hover {
                    background: color-mix(in srgb, var(--color-accent-primary) 15%, transparent) !important;
                    box-shadow: inset 0 0 0 1.5px var(--color-accent-primary) !important;
                    opacity: 1 !important;
                }
                .pill-non-device:not(:disabled):hover {
                    opacity: 0.9 !important;
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
                @media (prefers-reduced-motion: reduce) {
                    @keyframes pillActivate {
                        from { opacity: 0.4; }
                        to   { opacity: 1;   }
                    }
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
                                hasNotification={pendingTransfers.some(
                                    (t) => t.toPlayerId === p.id
                                )}
                                onSwitch={onSwitchPlayer}
                                onAction={onActionPlayer}
                            />
                        ))}

                        {/* Add player button — hidden at 4 active device players */}
                        {activeDevicePlayers.length < 4 && (
                            <button
                                style={styles.pillAdd}
                                className="pill-add"
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
                                    className={isActive ? "pill-active" : "pill-left"}
                                    onClick={() => {
                                        hapticLight();
                                        onSwitchPlayer(p.id);
                                    }}
                                    aria-pressed={isActive}
                                >
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
                                        className={isActive ? "pill-active" : "pill-non-device"}
                                        onClick={() => {
                                            hapticLight();
                                            onSwitchPlayer(p.id);
                                        }}
                                        aria-pressed={isActive}
                                    >
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

const AddPlayerSchema = z.object({
    displayName: z
        .string()
        .trim()
        .min(1, "Please enter a display name.")
        .max(
            MAX_DISPLAY_NAME_LENGTH,
            `Name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`
        ),
});

type AddPlayerValues = z.infer<typeof AddPlayerSchema>;

interface AddPlayerModalProps {
    session: Session;
    onClose: () => void;
    onSuccess: (playerId: string) => void;
}

function AddPlayerModal({ session, onClose, onSuccess }: AddPlayerModalProps) {
    const [pending, startTransition] = useTransition();
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<AddPlayerValues>({
        resolver: zodResolver(AddPlayerSchema),
        defaultValues: { displayName: "" },
    });

    async function onSubmit(values: AddPlayerValues) {
        startTransition(async () => {
            const savedToken = await playerTokenStore.get(session.joinCode, values.displayName);
            const result = await apiClient.joinByCodeAsGuest({
                joinCode: session.joinCode,
                displayName: values.displayName,
                playerToken: savedToken,
            });
            if (!result.ok) {
                const code = result.error.code;
                if (code === "CONFLICT_ERROR") {
                    setError("root", { message: "That name is in use on another device." });
                } else if (code === "AUTHENTICATION_ERROR") {
                    setError("root", {
                        message:
                            "This name belongs to a registered player. Ask them to join from their own device.",
                    });
                } else {
                    setError("root", { message: result.error.message });
                }
                return;
            }
            const { player, playerToken } = result.data;
            if (playerToken) {
                await playerTokenStore.set(session.joinCode, values.displayName, playerToken);
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
                <form onSubmit={handleSubmit(onSubmit)} style={styles.addPlayerForm}>
                    <input
                        style={styles.addPlayerInput}
                        type="text"
                        placeholder="Display name"
                        autoFocus
                        maxLength={MAX_DISPLAY_NAME_LENGTH}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="words"
                        spellCheck={false}
                        {...register("displayName")}
                    />
                    {errors.displayName && (
                        <p style={styles.addPlayerError}>{errors.displayName.message}</p>
                    )}
                    {errors.root && <p style={styles.addPlayerError}>{errors.root.message}</p>}
                    <div style={styles.addPlayerActions}>
                        <button type="button" style={styles.addPlayerCancel} onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                ...styles.addPlayerJoin,
                                opacity: !pending ? 1 : 0.45,
                            }}
                            disabled={pending}
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

function CardCarousel({ events, onCardTap, viewingPlayerName }: CardCarouselProps) {
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

const HOLD_DURATION_MS = 600;

function DrawButton({ isEnabled, isPending, onDraw }: DrawButtonProps) {
    const [holdState, setHoldState] = useState<"idle" | "holding" | "flashing">("idle");
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function cancelHold() {
        if (holdTimerRef.current !== null) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        setHoldState("idle");
    }

    function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
        if (!isEnabled || isPending) return;
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        setHoldState("holding");
        holdTimerRef.current = setTimeout(() => {
            holdTimerRef.current = null;
            setHoldState("flashing");
            setTimeout(() => setHoldState("idle"), 320);
            onDraw();
        }, HOLD_DURATION_MS);
    }

    function handlePointerUp() {
        cancelHold();
    }

    let borderColor = "var(--color-accent-primary)";
    let labelColor = "var(--color-text-primary)";
    let animationValue = "drawButtonGlow 4s ease-in-out infinite";
    let label = "HOLD TO DRAW";

    if (!isEnabled) {
        borderColor = "var(--color-border)";
        labelColor = "var(--color-text-secondary)";
        animationValue = "none";
    } else if (isPending) {
        animationValue = "drawButtonPulse 1s ease-in-out infinite";
        label = "DRAWING…";
    } else if (holdState === "holding") {
        animationValue = "drawButtonCharging 0.4s ease-in-out infinite";
    } else if (holdState === "flashing") {
        borderColor = "var(--color-accent-green)";
        animationValue = "drawButtonFire 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards";
        label = "DRAW";
    }

    // Fill overlay: gradient fill scaleX 0→1 during hold (600ms linear), green burst on flash.
    const fillIsFlashing = holdState === "flashing";
    const fillGradient =
        "linear-gradient(90deg, rgba(139, 127, 232, 0.22) 0%, rgba(139, 127, 232, 0.65) 68%, rgba(240, 237, 228, 0.45) 100%)";
    const fillTransition =
        holdState === "holding" ? `transform ${HOLD_DURATION_MS}ms linear` : "none";
    const fillScale = holdState === "holding" || fillIsFlashing ? 1 : 0;

    return (
        <button
            style={{
                ...styles.drawButton,
                borderColor,
                color: labelColor,
                animation: animationValue,
                opacity: !isEnabled ? 0.6 : 1,
                cursor: !isEnabled ? "default" : "pointer",
                position: "relative",
                overflow: "hidden",
                userSelect: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            disabled={!isEnabled && !isPending}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: fillIsFlashing ? "var(--color-accent-green)" : fillGradient,
                    opacity: fillIsFlashing ? 1 : holdState === "holding" ? 1 : 0,
                    transform: `scaleX(${fillScale})`,
                    transformOrigin: "left center",
                    transition: fillTransition,
                    animation: fillIsFlashing
                        ? "drawFillFlash 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards"
                        : "none",
                    pointerEvents: "none",
                }}
            />
            {label}
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
    const [ready, setReady] = useState(false);
    // introComplete starts true for standard (no intro hold), false for introOnly until audio ends
    const [introComplete, setIntroComplete] = useState(!drama?.introOnly);

    useEffect(() => {
        if (!drama) return;

        const loop = getAudio(drama.loopSound);
        loopRef.current = loop;

        if (drama.introOnly) {
            loop.loop = false;
            loop.onended = () => setIntroComplete(true);
            loop.play().catch(() => {});
        } else {
            loop.loop = true;
            loop.play().catch(() => {});
        }

        return () => {
            loop.onended = null;
            loop.pause();
            loopRef.current = null;
        };
    }, [drama]);

    return (
        <div
            style={{ ...styles.overlayBackdrop, pointerEvents: ready ? "auto" : "none" }}
            onClick={ready ? onDismiss : undefined}
        >
            <div
                style={{ ...styles.revealCardWrap, position: "relative", pointerEvents: "auto" }}
                onClick={(e) => e.stopPropagation()}
            >
                {drama?.preFlipLabel && !introComplete && (
                    <div style={styles.preFlipBadge}>{drama.preFlipLabel}</div>
                )}
                <FlippingCard
                    event={event}
                    dramaDelayMs={drama?.introOnly ? 0 : drama?.backMs}
                    overrideDuration={drama?.flipMs}
                    flipHeld={drama?.introOnly ? !introComplete : false}
                    onFlipComplete={() => {
                        setReady(true);
                        loopRef.current?.pause();
                        loopRef.current = null;
                        if (drama) getAudio(drama.hitSound).play().catch(() => {});
                    }}
                />
                <p
                    style={{
                        ...styles.revealDismissHint,
                        opacity: ready ? 0.5 : 0,
                        transition: ready ? "opacity 280ms ease" : "none",
                    }}
                >
                    Tap outside to dismiss
                </p>
            </div>
        </div>
    );
}

// ── CardDetailOverlay ─────────────────────────────────────────────────────────

interface CardDetailOverlayProps {
    event: DrawEvent;
    players: Player[];
    activePlayerId: string | null;
    pendingTransfer: CardTransfer | null;
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
    const [resolved, setResolved] = useState(event.resolved);
    const [sharing, setSharing] = useState(false);
    const [sharedViaActionBar, setSharedViaActionBar] = useState(event.descriptionShared);

    const showActionBarShareBtn = cv.hiddenInstructions !== null && !sharedViaActionBar && isDrawer;

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
        const next = !resolved;
        setResolved(next);
        await onResolve(event.id, next);
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
                <button style={styles.actionBtn} onClick={handleResolve} disabled={resolvePending}>
                    <span
                        style={{
                            ...styles.actionIcon,
                            color: resolved
                                ? "var(--color-success)"
                                : "var(--color-text-secondary)",
                        }}
                    >
                        ✓
                    </span>
                    <span style={styles.actionLabel}>{resolved ? "Resolved" : "Resolve"}</span>
                </button>

                {/* Transfer / Retract */}
                {(pendingTransfer || transferablePlayers.length > 0) &&
                    (pendingTransfer ? (
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
                            <span
                                style={{
                                    ...styles.actionLabel,
                                    color: "var(--color-accent-amber)",
                                }}
                            >
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
                    ))}

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
            setRevealDrama(prefersReduced ? null : STANDARD_DRAW_DRAMA);
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
                onSwitchPlayer={setActivePlayer}
                onAddPlayer={() => setShowAddPlayer(true)}
                onActionPlayer={setActionSheetTarget}
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

                    {session.status !== "active" && (
                        <div style={styles.endedBanner}>
                            <p style={styles.endedTitle}>This game has ended</p>
                            <button
                                style={styles.recapLink}
                                onClick={() => history.push(`/history/${session.id}`)}
                            >
                                View recap →
                            </button>
                        </div>
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
                    {resolvedCards.length > 0 && (
                        <button
                            style={styles.resolvedToggle}
                            onClick={() => setShowResolved((v) => !v)}
                        >
                            {showResolved
                                ? "Hide resolved"
                                : `Show ${resolvedCards.length} resolved`}
                        </button>
                    )}
                    <DrawButton
                        isEnabled={
                            isActivePlayerOnDevice && !drawPending && session.status === "active"
                        }
                        isPending={drawPending}
                        onDraw={handleDraw}
                    />
                    {session.status === "active" && (
                        <button
                            style={{
                                ...styles.reparationsLink,
                                opacity: reparationsPending ? 0.5 : 1,
                            }}
                            onClick={() => setShowReparationsConfirm(true)}
                            disabled={reparationsPending || !isActivePlayerOnDevice}
                        >
                            {reparationsPending ? "Drawing…" : "Draw reparations card"}
                        </button>
                    )}
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

            {showReparationsConfirm && (
                <AppDialog
                    title="Draw Reparations?"
                    message="A reparations card is drawn as a penalty. Once drawn, it's yours. Are you sure?"
                    accent="danger"
                    onDismiss={() => setShowReparationsConfirm(false)}
                    buttons={[
                        {
                            label: "Cancel",
                            variant: "ghost",
                            onClick: () => setShowReparationsConfirm(false),
                        },
                        {
                            label: "Draw",
                            variant: "danger",
                            onClick: () => {
                                setShowReparationsConfirm(false);
                                handleDrawReparations();
                            },
                        },
                    ]}
                />
            )}

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
        gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-4)",
        WebkitOverflowScrolling: "touch",
        alignItems: "center",
    },
    // ── Shared pill base ──────────────────────────────────────────────────────
    pillActive: {
        background: "var(--color-accent-primary)",
        clipPath:
            "polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)",
        boxShadow:
            "inset 0 1.5px 0 0 rgba(240, 237, 228, 0.22), inset 0 0 0 1.5px rgba(212, 168, 71, 0.45)",
        color: "var(--color-bg)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        padding: "0 var(--space-5)",
        height: "48px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        animation:
            "pillActivate 220ms cubic-bezier(0.22, 1, 0.36, 1) both, playerTokenGlow 2.4s ease-in-out infinite 220ms",
        transition:
            "color 200ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        minWidth: "72px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillInactive: {
        background: "var(--color-surface-elevated)",
        clipPath:
            "polygon(3px 0%, calc(100% - 3px) 0%, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0% calc(100% - 3px), 0% 3px)",
        boxShadow:
            "inset 0 0 0 1px color-mix(in srgb, var(--color-accent-primary) 45%, transparent)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 400,
        padding: "0 var(--space-3)",
        height: "38px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        transition:
            "color 200ms var(--ease), background 200ms var(--ease), box-shadow 200ms var(--ease), opacity 200ms var(--ease)",
        minWidth: "52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillNonDevice: {
        background:
            "color-mix(in srgb, var(--color-accent-amber) 7%, var(--color-surface-elevated))",
        clipPath:
            "polygon(3px 0%, calc(100% - 3px) 0%, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0% calc(100% - 3px), 0% 3px)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-accent-amber) 35%, transparent)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 400,
        padding: "0 var(--space-3)",
        height: "40px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.65,
        transition:
            "color 200ms var(--ease), background 200ms var(--ease), box-shadow 200ms var(--ease), opacity 200ms var(--ease)",
        minWidth: "52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillNonDeviceActive: {
        background: "var(--color-accent-amber)",
        clipPath:
            "polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)",
        boxShadow:
            "inset 0 1.5px 0 0 rgba(240, 237, 228, 0.18), inset 0 0 0 1.5px rgba(240, 237, 228, 0.12)",
        filter: "drop-shadow(0 0 16px rgba(212, 168, 71, 0.55))",
        animation: "pillActivate 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        color: "var(--color-bg)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        fontWeight: 700,
        letterSpacing: "-0.01em",
        padding: "0 var(--space-5)",
        height: "48px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 1,
        transition:
            "color 200ms cubic-bezier(0.22, 1, 0.36, 1), background 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        minWidth: "72px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillName: {
        fontFamily: "var(--font-display)",
        fontSize: "inherit",
        letterSpacing: "-0.02em",
        fontStyle: "italic",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
    },
    avatarActive: {},
    avatarInactive: {},
    avatarNonDevice: {},
    avatarNonDeviceActive: {},
    // Left (inactive) device player pills
    pillLeft: {
        background: "var(--color-surface)",
        clipPath:
            "polygon(3px 0%, calc(100% - 3px) 0%, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0% calc(100% - 3px), 0% 3px)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-border) 40%, transparent)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 400,
        padding: "0 var(--space-3)",
        height: "36px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.45,
        transition:
            "color 200ms var(--ease), background 200ms var(--ease), opacity 200ms var(--ease)",
        minWidth: "52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    pillLeftActive: {
        background: "color-mix(in srgb, var(--color-text-secondary) 8%, var(--color-surface))",
        clipPath:
            "polygon(3px 0%, calc(100% - 3px) 0%, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0% calc(100% - 3px), 0% 3px)",
        boxShadow: "inset 0 0 0 1px var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 500,
        padding: "0 var(--space-3)",
        height: "40px",
        whiteSpace: "nowrap",
        cursor: "pointer",
        flexShrink: 0,
        opacity: 0.7,
        transition:
            "color 200ms var(--ease), background 200ms var(--ease), opacity 200ms var(--ease)",
        minWidth: "52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
    },
    avatarLeft: {},
    avatarLeftActive: {},
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
        clipPath:
            "polygon(3px 0%, calc(100% - 3px) 0%, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 0% calc(100% - 3px), 0% 3px)",
        boxShadow:
            "inset 0 0 0 1.5px color-mix(in srgb, var(--color-accent-primary) 50%, transparent)",
        color: "color-mix(in srgb, var(--color-accent-primary) 70%, transparent)",
        fontSize: "22px",
        fontWeight: 300,
        lineHeight: 1,
        width: "38px",
        height: "38px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition:
            "color 200ms var(--ease), background 200ms var(--ease), box-shadow 200ms var(--ease), opacity 200ms var(--ease)",
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
    reparationsLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        opacity: 0.6,
        cursor: "pointer",
        padding: "var(--space-2) 0 0",
        textAlign: "center" as const,
        width: "100%",
        letterSpacing: "0.04em",
        transition: "opacity 160ms var(--ease)",
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
    endedBanner: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-4) var(--space-5)",
        margin: "var(--space-4) 0",
        border: "1px solid var(--color-border)",
        borderRadius: "4px",
        backgroundColor: "var(--color-surface)",
    },
    endedTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
        letterSpacing: "0.04em",
    },
    recapLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-accent-amber)",
        cursor: "pointer",
        padding: 0,
        letterSpacing: "0.04em",
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
        boxShadow: "0 6px 14px -8px color-mix(in srgb, var(--color-accent-amber) 75%, transparent)",
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
