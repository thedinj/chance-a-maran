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
    /** One-shot intro sound. Flip is held until it finishes (via onended). */
    introSound?: string;
    /** Sound looped during the flip (and reparations intro). */
    loopSound: string;
    /** One-shot sound fired when flip completes */
    hitSound: string;
    /** ms to show card back (static) before the flip begins — ignored when introSound is set */
    backMs: number;
    /** flip animation duration ms (passed as overrideDuration to FlippingCard) */
    flipMs: number;
    /** CSS easing for the flip animation */
    flipEasing?: string;
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
    introSound: "/sound/drama.mp3",
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    backMs: 0, // unused — drama.mp3 duration drives the hold
    flipMs: 3000,
    flipEasing: "cubic-bezier(0.42, 0, 0.58, 1)", // ease-in-out — fills the full 3s
    preFlipLabel: "GAME CHANGER",
};

const REPARATIONS_DRAMA: DrawDrama = {
    loopSound: "/sound/drumrollloop.mp3",
    hitSound: "/sound/cymbal.mp3",
    backMs: 1400, // long hold on the back — let dread build
    flipMs: 2600, // slow, inevitable flip
    flipEasing: "cubic-bezier(0.42, 0, 0.58, 1)", // ease-in-out — fills the full 2.6s
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
            onContextMenu={(e) => e.preventDefault()}
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

// ── SpotlightCanvas ───────────────────────────────────────────────────────────

interface SpotlightCanvasProps {
    isGameChanger: boolean;
    isReparations: boolean;
    /** Flip animation is currently in progress */
    flipping: boolean;
    /** Flip complete — card front is fully revealed */
    locked: boolean;
}

function SpotlightCanvas({ isGameChanger, isReparations, flipping, locked }: SpotlightCanvasProps) {
    const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef({
        flipping: false,
        locked: false,
        lockedAt: null as number | null,
        rings: [] as Array<{ bornAt: number }>,
    });

    useEffect(() => {
        animRef.current.flipping = flipping;
        animRef.current.locked = locked;
        if (locked && animRef.current.lockedAt === null) {
            animRef.current.lockedAt = performance.now();
            // Reparations: fire 3 shockwave rings staggered 180ms apart
            if (isReparations) {
                const now = performance.now();
                animRef.current.rings = [
                    { bornAt: now },
                    { bornAt: now + 180 },
                    { bornAt: now + 360 },
                ];
            }
        }
    }, [flipping, locked, isReparations]);

    useEffect(() => {
        if (prefersReduced) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        function resize() {
            if (canvas) {
                canvas.width = canvas.offsetWidth || window.innerWidth;
                canvas.height = canvas.offsetHeight || window.innerHeight;
            }
        }
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        const startTime = performance.now();
        // Reparations: blackest void + deep vein-red. GC: blood crimson. Standard: amber.
        const [cr, cg, cb]: [number, number, number] = isReparations
            ? [110, 8, 8] // dark vein-red — deeper than GC
            : isGameChanger
              ? [165, 18, 18] // blood crimson
              : [212, 168, 71]; // amber

        function easeOut(t: number) {
            return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
        }
        function lerp(a: number, b: number, t: number) {
            return a + (b - a) * Math.max(0, Math.min(1, t));
        }

        let frameId = 0;

        function draw() {
            if (!canvas || !ctx) return;
            const W = canvas.width;
            const H = canvas.height;
            if (W === 0 || H === 0) {
                frameId = requestAnimationFrame(draw);
                return;
            }

            const now = performance.now();
            const elapsed = now - startTime;
            const { flipping, locked, lockedAt } = animRef.current;

            // Sweep: 0→1 over 2.4s for GC (slow, ominous), 1.4s for standard
            const sweepDuration = isGameChanger ? 2400 : 1400;
            const sweepT = easeOut(elapsed / sweepDuration);

            // Card center approximation in canvas space
            const cardX = W * 0.5;
            const cardY = H * 0.44;

            ctx.clearRect(0, 0, W, H);

            // ── Vignette: deepen theatrical darkness at edges ─────────────────
            const vigR = Math.max(W, H) * 1.1;
            const vigGrad = ctx.createRadialGradient(cardX, cardY, H * 0.08, cardX, cardY, vigR);
            vigGrad.addColorStop(0, "rgba(0,0,0,0)");
            if (isReparations) {
                vigGrad.addColorStop(0.45, "rgba(2,0,0,0.22)");
                vigGrad.addColorStop(1, "rgba(4,0,0,0.72)"); // deeper void for reparations
            } else {
                vigGrad.addColorStop(0.55, `rgba(${isGameChanger ? "4,0,0" : "0,0,4"},0.1)`);
                vigGrad.addColorStop(1, `rgba(${isGameChanger ? "6,0,0" : "0,0,6"},0.42)`);
            }
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, W, H);

            // ── Light source position ─────────────────────────────────────────
            let srcX: number, srcY: number;
            if (isReparations) {
                // Dead center overhead — the light never moves, it was always there
                // Slight sinusoidal drift like a single bulb on a cord swaying
                const sway = Math.sin(elapsed * 0.0006) * W * 0.025;
                srcX = cardX + sway;
                srcY = H * -0.08;
            } else if (isGameChanger) {
                // Ominous sweep from upper-left into position — slow, deliberate
                const drift = Math.sin(elapsed * 0.0008) * W * 0.04;
                srcX = lerp(W * -0.25, cardX + drift, sweepT);
                srcY = lerp(H * -0.55, H * -0.18, sweepT);
            } else {
                // Standard: centrally overhead, static
                srcX = cardX;
                srcY = H * -0.12;
            }

            // ── Intensity ─────────────────────────────────────────────────────
            let intensity: number;
            if (isReparations) {
                // Already there from the start — no sweep. Breathes slowly.
                const breath = 1 + Math.sin(elapsed * 0.0018) * 0.12;
                intensity = 0.38 * breath;
            } else if (isGameChanger) {
                intensity = lerp(0.0, 0.42, sweepT);
                // GC: subtle flicker while unrevealed
                if (!locked) intensity *= 1 + Math.sin(elapsed * 0.0031) * 0.07;
            } else {
                intensity = lerp(0.18, 0.44, sweepT);
            }

            if (flipping) intensity = Math.min(intensity + 0.14, 0.72);
            if (locked) intensity = Math.min(intensity + (isReparations ? 0.28 : 0.2), 0.88);

            // ── Main spotlight cone ───────────────────────────────────────────
            const coneGrad = ctx.createRadialGradient(
                srcX,
                srcY,
                0,
                cardX,
                cardY,
                Math.max(W, H) * 0.75
            );
            coneGrad.addColorStop(0, `rgba(${cr},${cg},${cb},${intensity * 0.85})`);
            coneGrad.addColorStop(0.12, `rgba(${cr},${cg},${cb},${intensity * 0.55})`);
            coneGrad.addColorStop(0.38, `rgba(${cr},${cg},${cb},${intensity * 0.18})`);
            coneGrad.addColorStop(0.65, `rgba(${cr},${cg},${cb},${intensity * 0.05})`);
            coneGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = coneGrad;
            ctx.fillRect(0, 0, W, H);

            // ── Bloom on reveal ───────────────────────────────────────────────
            if (locked && lockedAt !== null) {
                const bloomAge = (now - lockedAt) / 1000;
                const bloomT = Math.min(bloomAge / 0.9, 1);
                const bloomEased = easeOut(bloomT);

                // Opacity arc: ramps up sharply then settles to ~55%
                const bloomOpacity =
                    bloomT < 0.3 ? bloomT / 0.3 : 1 - ((bloomT - 0.3) / 0.7) * 0.45;

                const bloomR = lerp(10, isGameChanger ? W * 0.82 : W * 0.68, bloomEased);
                const bloomGrad = ctx.createRadialGradient(cardX, cardY, 0, cardX, cardY, bloomR);
                bloomGrad.addColorStop(0, `rgba(${cr},${cg},${cb},${bloomOpacity * 0.34})`);
                bloomGrad.addColorStop(0.32, `rgba(${cr},${cg},${cb},${bloomOpacity * 0.15})`);
                bloomGrad.addColorStop(0.68, `rgba(${cr},${cg},${cb},${bloomOpacity * 0.05})`);
                bloomGrad.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = bloomGrad;
                ctx.fillRect(0, 0, W, H);
            }

            // ── Shockwave rings (reparations only) ───────────────────────────
            if (isReparations && animRef.current.rings.length > 0) {
                const maxRadius = Math.max(W, H) * 0.72;
                const ringDuration = 900; // ms per ring
                for (const ring of animRef.current.rings) {
                    const age = now - ring.bornAt;
                    if (age < 0) continue; // staggered — not born yet
                    const t = Math.min(age / ringDuration, 1);
                    const eased = easeOut(t);
                    const radius = lerp(20, maxRadius, eased);
                    // Opacity: quick ramp-up, then long fade out
                    const opacity = t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92;
                    ctx.beginPath();
                    ctx.arc(cardX, cardY, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${opacity * 0.62})`;
                    ctx.lineWidth = lerp(3.5, 0.5, eased); // ring thins as it expands
                    ctx.stroke();
                }
            }

            frameId = requestAnimationFrame(draw);
        }

        frameId = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(frameId);
            ro.disconnect();
        };
    }, [isGameChanger, isReparations, prefersReduced]);

    if (prefersReduced) return null;

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 0,
            }}
        />
    );
}

// ── ReparationsIntroSequence ──────────────────────────────────────────────────
// Pre-reveal tribunal sequence: scanner sweep → 3 staccato name title-cards.
// Calls onComplete when the sequence ends (~2100ms).

const REPARATIONS_INTRO_CSS = `
@keyframes repScanLine {
    0%   { top: -2px;   opacity: 0; }
    4%   { opacity: 1; }
    96%  { opacity: 1; }
    100% { top: 100%;   opacity: 0; }
}
@keyframes repNameFlash {
    0%   { opacity: 0; }
    6%   { opacity: 1; }
    94%  { opacity: 1; }
    100% { opacity: 0; }
}
`;

interface ReparationsIntroProps {
    playerDisplayName: string;
    onComplete: () => void;
}

function ReparationsIntroSequence({ playerDisplayName, onComplete }: ReparationsIntroProps) {
    // frame: null = scanner phase, 1/2/3 = title-card flashes
    const [frame, setFrame] = useState<null | 1 | 2 | 3>(null);

    useEffect(() => {
        // Scanner runs 900ms, then 3 frames at 200ms each with 60ms gaps
        const t1 = window.setTimeout(() => setFrame(1), 900);
        const t2 = window.setTimeout(() => setFrame(null), 1100);
        const t3 = window.setTimeout(() => setFrame(2), 1180);
        const t4 = window.setTimeout(() => setFrame(null), 1360);
        const t5 = window.setTimeout(() => setFrame(3), 1440);
        const t6 = window.setTimeout(() => setFrame(null), 1590);
        const t7 = window.setTimeout(() => onComplete(), 1750);
        return () => {
            [t1, t2, t3, t4, t5, t6, t7].forEach(window.clearTimeout);
        };
    }, [onComplete]);

    // Title-card parameters per frame — deliberately thrown off-axis
    const frameParams: Record<1 | 2 | 3, { scale: number; x: number; opacity: number }> = {
        1: { scale: 1.72, x: 18, opacity: 0.18 }, // huge, ghostly — barely there
        2: { scale: 1.0, x: 0, opacity: 0.92 }, // full weight — the verdict
        3: { scale: 0.84, x: -10, opacity: 0.55 }, // smaller, offset — unsettled
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                backgroundColor: "rgb(3, 0, 0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}
            aria-hidden="true"
        >
            <style>{REPARATIONS_INTRO_CSS}</style>

            {/* Red scanner line sweeping top → bottom */}
            {frame === null && (
                <div
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        height: "2px",
                        background:
                            "linear-gradient(90deg, transparent, rgba(180,12,12,0.9) 20%, rgb(220,14,14) 50%, rgba(180,12,12,0.9) 80%, transparent)",
                        boxShadow:
                            "0 0 18px 4px rgba(180,10,10,0.55), 0 0 40px 8px rgba(140,6,6,0.25)",
                        animation: "repScanLine 900ms cubic-bezier(0.4, 0, 0.6, 1) forwards",
                        pointerEvents: "none",
                    }}
                />
            )}

            {/* Staccato name title-card flashes */}
            {frame !== null &&
                (() => {
                    const p = frameParams[frame];
                    return (
                        <div
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(52px, 14vw, 88px)",
                                fontWeight: 700,
                                letterSpacing: "-0.03em",
                                lineHeight: 1,
                                color: "rgb(220, 14, 14)",
                                opacity: p.opacity,
                                transform: `scale(${p.scale}) translateX(${p.x}px)`,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "85vw",
                                userSelect: "none",
                                textShadow:
                                    frame === 2
                                        ? "0 0 60px rgba(220,14,14,0.6), 0 0 120px rgba(180,8,8,0.3)"
                                        : "none",
                            }}
                        >
                            {playerDisplayName}
                        </div>
                    );
                })()}
        </div>
    );
}

// ── CardRevealOverlay ─────────────────────────────────────────────────────────

interface CardRevealOverlayProps {
    event: DrawEvent;
    onDismiss: () => void;
    drama?: DrawDrama;
    playerDisplayName?: string;
}

type RevealPhase = "reparations-intro" | "audio-intro" | "flipping" | "revealed";

function CardRevealOverlay({ event, onDismiss, drama, playerDisplayName }: CardRevealOverlayProps) {
    const loopRef = useRef<HTMLAudioElement | null>(null);
    const isGameChanger = Boolean(event.cardVersion.isGameChanger);
    const isReparations = event.card.cardType === "reparations";

    const initialPhase: RevealPhase = isReparations
        ? "reparations-intro"
        : drama?.introSound
          ? "audio-intro"
          : "flipping";
    const [phase, setPhase] = useState<RevealPhase>(initialPhase);

    // ── Intro sound (game changer drama.mp3) ─────────────────────────────────
    // Plays once during "audio-intro" phase. When it ends, advances to "flipping".
    useEffect(() => {
        if (phase !== "audio-intro" || !drama?.introSound) return;
        const audio = getAudio(drama.introSound);
        audio.loop = false;
        audio.onended = () => setPhase("flipping");
        audio.play().catch(() => {});
        return () => {
            audio.onended = null;
            audio.pause();
        };
    }, [phase, drama]);

    // ── Loop sound (drumroll) ────────────────────────────────────────────────
    // Plays during "flipping" and "reparations-intro" phases. For reparations,
    // starts on mount (within user gesture chain) and continues uninterrupted
    // through the intro into the flip. Cleanup pauses when phase → "revealed".
    const loopActive = phase === "flipping" || phase === "reparations-intro";
    useEffect(() => {
        if (!loopActive || !drama) return;
        const audio = getAudio(drama.loopSound);
        loopRef.current = audio;
        audio.loop = true;
        audio.play().catch(() => {});
        return () => {
            audio.pause();
            loopRef.current = null;
        };
    }, [loopActive, drama]);

    const handleFlipComplete = useCallback(() => {
        setPhase("revealed");
        if (drama) getAudio(drama.hitSound).play().catch(() => {});
    }, [drama]);

    const handleReparationsIntroDone = useCallback(() => {
        setPhase(drama?.introSound ? "audio-intro" : "flipping");
    }, [drama]);

    if (phase === "reparations-intro") {
        return (
            <ReparationsIntroSequence
                playerDisplayName={playerDisplayName ?? "—"}
                onComplete={handleReparationsIntroDone}
            />
        );
    }

    const ready = phase === "revealed";
    const flipping = phase === "flipping";

    return (
        <div
            style={{ ...styles.overlayBackdrop, pointerEvents: ready ? "auto" : "none" }}
            onClick={ready ? onDismiss : undefined}
        >
            <SpotlightCanvas
                isGameChanger={isGameChanger}
                isReparations={isReparations}
                flipping={flipping}
                locked={ready}
            />
            <div
                style={{
                    ...styles.revealCardWrap,
                    position: "relative",
                    pointerEvents: "auto",
                    zIndex: 1,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {drama?.preFlipLabel && phase === "audio-intro" && (
                    <div style={styles.preFlipBadge}>{drama.preFlipLabel}</div>
                )}
                <FlippingCard
                    event={event}
                    dramaDelayMs={drama?.introSound ? 0 : drama?.backMs}
                    overrideDuration={drama?.flipMs}
                    overrideEasing={drama?.flipEasing}
                    flipHeld={phase === "audio-intro"}
                    onFlipComplete={handleFlipComplete}
                />
                <p
                    style={{
                        ...styles.revealDismissHint,
                        opacity: ready ? 0.5 : 0,
                        transition: ready ? "opacity 280ms ease" : "none",
                    }}
                >
                    {isReparations ? "This is yours now." : "Tap outside to dismiss"}
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
    onShareDescription: (drawEventId: string) => Promise<boolean>;
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
        const ok = await onShareDescription(event.id);
        if (ok) setSharedViaActionBar(true);
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
                    playerDisplayName={
                        players.find((p) => p.id === revealCard.playerId)?.displayName
                    }
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
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        minWidth: 0,
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
        overflow: "hidden",
        textOverflow: "ellipsis",
        maxWidth: "120px",
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
        userSelect: "none",
        WebkitUserSelect: "none",
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
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        width: "100%",
        boxSizing: "border-box" as const,
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
