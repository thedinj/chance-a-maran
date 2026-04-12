import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { Card, CardVersion } from "../../lib/api";
import { FlippingCard } from "../GameCard";
import { getAudio, preloadSoundIfNeeded } from "../../lib/sounds";
import { apiClient } from "../../lib/api";
import { useOverlayBackButton } from "../../hooks/useOverlayBackButton";
import type { DrawDrama, RevealPhase } from "./types";
import { GAME_CHANGER_DRAMA, REPARATIONS_DRAMA, STANDARD_DRAW_DRAMA } from "./types";

// ── Drama derivation ──────────────────────────────────────────────────────────

function toDrama(card: Card, cardVersion: CardVersion): DrawDrama {
    if (card.cardType === "reparations") return REPARATIONS_DRAMA;
    if (cardVersion.isGameChanger) return GAME_CHANGER_DRAMA;
    return STANDARD_DRAW_DRAMA;
}

// ── SpotlightCanvas ───────────────────────────────────────────────────────────

interface SpotlightCanvasProps {
    isGameChanger: boolean;
    isReparations: boolean;
    flipping: boolean;
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
        const [cr, cg, cb]: [number, number, number] = isReparations
            ? [110, 8, 8]
            : isGameChanger
              ? [165, 18, 18]
              : [212, 168, 71];

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

            const sweepDuration = isGameChanger ? 2400 : 1400;
            const sweepT = easeOut(elapsed / sweepDuration);

            const cardX = W * 0.5;
            const cardY = H * 0.44;

            ctx.clearRect(0, 0, W, H);

            const vigR = Math.max(W, H) * 1.1;
            const vigGrad = ctx.createRadialGradient(cardX, cardY, H * 0.08, cardX, cardY, vigR);
            vigGrad.addColorStop(0, "rgba(0,0,0,0)");
            if (isReparations) {
                vigGrad.addColorStop(0.45, "rgba(2,0,0,0.22)");
                vigGrad.addColorStop(1, "rgba(4,0,0,0.72)");
            } else {
                vigGrad.addColorStop(0.55, `rgba(${isGameChanger ? "4,0,0" : "0,0,4"},0.1)`);
                vigGrad.addColorStop(1, `rgba(${isGameChanger ? "6,0,0" : "0,0,6"},0.42)`);
            }
            ctx.fillStyle = vigGrad;
            ctx.fillRect(0, 0, W, H);

            let srcX: number, srcY: number;
            if (isReparations) {
                const sway = Math.sin(elapsed * 0.0006) * W * 0.025;
                srcX = cardX + sway;
                srcY = H * -0.08;
            } else if (isGameChanger) {
                const drift = Math.sin(elapsed * 0.0008) * W * 0.04;
                srcX = lerp(W * -0.25, cardX + drift, sweepT);
                srcY = lerp(H * -0.55, H * -0.18, sweepT);
            } else {
                srcX = cardX;
                srcY = H * -0.12;
            }

            let intensity: number;
            if (isReparations) {
                const breath = 1 + Math.sin(elapsed * 0.0018) * 0.12;
                intensity = 0.38 * breath;
            } else if (isGameChanger) {
                intensity = lerp(0.0, 0.42, sweepT);
                if (!locked) intensity *= 1 + Math.sin(elapsed * 0.0031) * 0.07;
            } else {
                intensity = lerp(0.18, 0.44, sweepT);
            }

            if (flipping) intensity = Math.min(intensity + 0.14, 0.72);
            if (locked) intensity = Math.min(intensity + (isReparations ? 0.28 : 0.2), 0.88);

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

            if (locked && lockedAt !== null) {
                const bloomAge = (now - lockedAt) / 1000;
                const bloomT = Math.min(bloomAge / 0.9, 1);
                const bloomEased = easeOut(bloomT);
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

            if (isReparations && animRef.current.rings.length > 0) {
                const maxRadius = Math.max(W, H) * 0.72;
                const ringDuration = 900;
                for (const ring of animRef.current.rings) {
                    const age = now - ring.bornAt;
                    if (age < 0) continue;
                    const t = Math.min(age / ringDuration, 1);
                    const eased = easeOut(t);
                    const radius = lerp(20, maxRadius, eased);
                    const opacity = t < 0.08 ? t / 0.08 : 1 - (t - 0.08) / 0.92;
                    ctx.beginPath();
                    ctx.arc(cardX, cardY, radius, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${opacity * 0.62})`;
                    ctx.lineWidth = lerp(3.5, 0.5, eased);
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

const REPARATIONS_LABELS = ["REPARATIONS", "NOWHERE TO RUN", "GUILTY", "SETTLE UP"] as const;

interface ReparationsIntroProps {
    onComplete: () => void;
}

function ReparationsIntroSequence({ onComplete }: ReparationsIntroProps) {
    const [label] = useState(
        () => REPARATIONS_LABELS[Math.floor(Math.random() * REPARATIONS_LABELS.length)]
    );
    const [frame, setFrame] = useState<null | 1 | 2 | 3>(null);

    useEffect(() => {
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

    const frameParams: Record<1 | 2 | 3, { scale: number; x: number; opacity: number }> = {
        1: { scale: 1.72, x: 18, opacity: 0.18 },
        2: { scale: 1.0, x: 0, opacity: 0.92 },
        3: { scale: 0.84, x: -10, opacity: 0.55 },
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

            {frame !== null &&
                (() => {
                    const p = frameParams[frame];
                    return (
                        <div
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "clamp(40px, 10.5vw, 88px)",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                lineHeight: 1.1,
                                color: "rgb(220, 14, 14)",
                                WebkitTextStroke: "1.5px rgba(212, 168, 71, 0.4)",
                                WebkitTextFillColor: "rgb(220, 14, 14)",
                                opacity: p.opacity,
                                transform: `scale(${p.scale}) translateX(${p.x}px)`,
                                whiteSpace: "normal",
                                textAlign: "center",
                                maxWidth: "88vw",
                                userSelect: "none",
                                textShadow:
                                    frame === 1
                                        ? "0 0 40px rgba(220,14,14,0.35)"
                                        : frame === 2
                                          ? "2px 2px 0 rgba(60,0,0,0.9), 0 0 30px rgba(220,14,14,0.8), 0 0 80px rgba(180,8,8,0.5), 0 0 140px rgba(140,6,6,0.3)"
                                          : "0 0 50px rgba(220,14,14,0.45)",
                            }}
                        >
                            {label}
                        </div>
                    );
                })()}
        </div>
    );
}

// ── CardReveal ────────────────────────────────────────────────────────────────

export interface CardRevealProps {
    card: Card;
    cardVersion: CardVersion;
    onDismiss: () => void;
    /** "dramatic" = full theatrical reveal (default). "quick" = fast flip, no spotlight/sounds. */
    mode?: "dramatic" | "quick";
    /** Rendered below the card once it's fully revealed. */
    footer?: React.ReactNode;
    /** Forwarded to CardFront as onReveal. Called when drawer taps "Tap to reveal". */
    onCardReveal?: () => void;
}

const overlayBackdrop: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    backgroundColor: "color-mix(in srgb, var(--color-bg) 97%, transparent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--space-5)",
};

const quickBackdrop: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    backgroundColor: "var(--color-bg)",
    display: "flex",
    flexDirection: "column",
    paddingTop: "env(safe-area-inset-top)",
    paddingBottom: "env(safe-area-inset-bottom)",
    cursor: "pointer",
};

const revealCardWrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--space-4)",
    width: "100%",
    maxWidth: "430px",
    animation: "cardDeal 380ms var(--ease) forwards",
};

const gcLogoWrap: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "90%",
    zIndex: 10,
    pointerEvents: "none",
};

const revealDismissHint: React.CSSProperties = {
    fontFamily: "var(--font-ui)",
    fontSize: "var(--text-caption)",
    color: "var(--color-text-secondary)",
    margin: 0,
    textAlign: "center",
};

export function CardReveal({
    card,
    cardVersion,
    onDismiss,
    mode = "dramatic",
    footer,
    onCardReveal,
}: CardRevealProps) {
    useOverlayBackButton(onDismiss);

    const isReparations = card.cardType === "reparations";
    const isGameChanger = Boolean(cardVersion.isGameChanger);
    const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── Quick mode ────────────────────────────────────────────────────────────
    if (mode === "quick") {
        return ReactDOM.createPortal(
            <QuickReveal
                card={card}
                cardVersion={cardVersion}
                onDismiss={onDismiss}
                footer={footer}
                onCardReveal={onCardReveal}
            />,
            document.body
        );
    }

    // ── Dramatic mode — resolve drama + sounds on mount ───────────────────────
    const drama = prefersReduced ? null : toDrama(card, cardVersion);

    // Resolve custom hit sound from cardVersion.soundId
    const customHitSound =
        cardVersion.soundId ? (apiClient.resolveMediaUrl(cardVersion.soundId) ?? undefined) : undefined;

    return ReactDOM.createPortal(
        <DramaticReveal
            card={card}
            cardVersion={cardVersion}
            isReparations={isReparations}
            isGameChanger={isGameChanger}
            prefersReduced={prefersReduced}
            drama={drama}
            customHitSound={customHitSound}
            onDismiss={onDismiss}
            footer={footer}
            onCardReveal={onCardReveal}
        />,
        document.body
    );
}

// ── QuickReveal ───────────────────────────────────────────────────────────────

interface QuickRevealProps {
    card: Card;
    cardVersion: CardVersion;
    onDismiss: () => void;
    footer?: React.ReactNode;
    onCardReveal?: () => void;
}

function QuickReveal({ card, cardVersion, onDismiss, footer, onCardReveal }: QuickRevealProps) {
    const [flipped, setFlipped] = useState(false);

    useEffect(() => {
        // Immediately begin flip on mount
        setFlipped(false);
        const t = window.setTimeout(() => setFlipped(true), 0);
        return () => window.clearTimeout(t);
    }, []);

    return (
        <div style={quickBackdrop} onClick={onDismiss}>
            <div
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-3) var(--space-5)", minHeight: 0 }}
            >
                <div
                    style={{ maxWidth: "430px", width: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <FlippingCard
                        card={card}
                        cardVersion={cardVersion}
                        overrideDuration={480}
                        onReveal={onCardReveal}
                    />
                </div>
            </div>
            {flipped && footer && (
                <div onClick={(e) => e.stopPropagation()}>{footer}</div>
            )}
        </div>
    );
}

// ── DramaticReveal ────────────────────────────────────────────────────────────

interface DramaticRevealProps {
    card: Card;
    cardVersion: CardVersion;
    isReparations: boolean;
    isGameChanger: boolean;
    prefersReduced: boolean;
    drama: DrawDrama | null;
    customHitSound: string | undefined;
    onDismiss: () => void;
    footer?: React.ReactNode;
    onCardReveal?: () => void;
}

function DramaticReveal({
    card,
    cardVersion,
    isReparations,
    isGameChanger,
    prefersReduced,
    drama,
    customHitSound,
    onDismiss,
    footer,
    onCardReveal,
}: DramaticRevealProps) {
    const loopRef = useRef<HTMLAudioElement | null>(null);

    // Preload custom sound on mount
    useEffect(() => {
        if (customHitSound) preloadSoundIfNeeded(customHitSound);
    }, [customHitSound]);

    // Resolve the effective drama (with custom hit sound override).
    // Memoized so the object reference stays stable across re-renders — prevents sound
    // useEffects from re-running (and replaying audio) on unrelated state changes.
    const effectiveDrama = useMemo(() => {
        if (!drama) return null;
        if (customHitSound !== undefined) {
            return {
                ...drama,
                hitSound: customHitSound,
                ...(isReparations ? { hitSoundOffsetMs: REPARATIONS_DRAMA.flipMs - 250 } : {}),
            };
        }
        return drama;
    }, [drama, customHitSound, isReparations]);

    const initialPhase: RevealPhase = isReparations
        ? "reparations-intro"
        : effectiveDrama?.introSound
          ? "audio-intro"
          : "flipping";
    const [phase, setPhase] = useState<RevealPhase>(initialPhase);
    const [gcExiting, setGcExiting] = useState(false);

    // Intro sound (game changer drama.mp3)
    useEffect(() => {
        if (phase !== "audio-intro" || !effectiveDrama?.introSound) return;
        const audio = getAudio(effectiveDrama.introSound);
        audio.loop = false;
        audio.onended = () => setGcExiting(true);
        audio.play().catch(() => {});
        return () => {
            audio.onended = null;
            audio.pause();
        };
    }, [phase, effectiveDrama]);

    // Advance to "flipping" after gc logo exit animation
    useEffect(() => {
        if (!gcExiting) return;
        const t = setTimeout(() => setPhase("flipping"), 220);
        return () => clearTimeout(t);
    }, [gcExiting]);

    // Loop sound (drumroll)
    const loopActive = phase === "flipping" || phase === "reparations-intro";
    useEffect(() => {
        if (!loopActive || !effectiveDrama?.loopSound) return;
        const audio = getAudio(effectiveDrama.loopSound);
        loopRef.current = audio;
        audio.loop = true;
        audio.play().catch(() => {});
        return () => {
            audio.pause();
            loopRef.current = null;
        };
    }, [loopActive, effectiveDrama]);

    // Single intro sound during reparations intro + flip
    useEffect(() => {
        if (!loopActive || !effectiveDrama?.introSound || effectiveDrama.loopSound) return;
        const audio = getAudio(effectiveDrama.introSound);
        audio.loop = false;
        audio.play().catch(() => {});
        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [loopActive, effectiveDrama]);

    // Early hit sound
    useEffect(() => {
        if (
            phase !== "flipping" ||
            !effectiveDrama?.hitSound ||
            effectiveDrama.hitSoundOffsetMs === undefined
        )
            return;
        const t = setTimeout(() => {
            loopRef.current?.pause();
            loopRef.current = null;
            getAudio(effectiveDrama.hitSound!)
                .play()
                .catch(() => {});
        }, effectiveDrama.hitSoundOffsetMs);
        return () => clearTimeout(t);
    }, [phase, effectiveDrama]);

    const handleFlipComplete = useCallback(() => {
        setPhase("revealed");
        if (effectiveDrama?.hitSound && effectiveDrama.hitSoundOffsetMs === undefined)
            getAudio(effectiveDrama.hitSound)
                .play()
                .catch(() => {});
    }, [effectiveDrama]);

    const handleReparationsIntroDone = useCallback(() => {
        setPhase("flipping");
    }, []);

    if (phase === "reparations-intro") {
        return <ReparationsIntroSequence onComplete={handleReparationsIntroDone} />;
    }

    const ready = phase === "revealed";
    const flipping = phase === "flipping";

    return (
        <div
            style={{ ...overlayBackdrop, pointerEvents: ready ? "auto" : "none" }}
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
                    ...revealCardWrap,
                    position: "relative",
                    pointerEvents: "auto",
                    zIndex: 1,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {isGameChanger && (phase === "audio-intro" || gcExiting) && (
                    <div style={gcLogoWrap}>
                        <img
                            src="/img/GameChanger.png"
                            alt=""
                            aria-hidden="true"
                            style={
                                prefersReduced
                                    ? { width: "100%", height: "auto", display: "block" }
                                    : gcExiting
                                      ? {
                                            width: "100%",
                                            height: "auto",
                                            display: "block",
                                            animation:
                                                "gcLogoExit 220ms cubic-bezier(0.55, 0, 1, 0.45) forwards",
                                        }
                                      : {
                                            width: "100%",
                                            height: "auto",
                                            display: "block",
                                            animation:
                                                "gcLogoEnter 500ms cubic-bezier(0.25, 0, 0.1, 1) forwards, gcLogoFloat 2.2s ease-in-out 500ms infinite",
                                        }
                            }
                        />
                    </div>
                )}
                <FlippingCard
                    card={card}
                    cardVersion={cardVersion}
                    dramaDelayMs={phase === "audio-intro" ? 0 : effectiveDrama?.backMs}
                    overrideDuration={effectiveDrama?.flipMs}
                    overrideEasing={effectiveDrama?.flipEasing}
                    flipHeld={phase === "audio-intro"}
                    onFlipComplete={handleFlipComplete}
                    onReveal={onCardReveal}
                />
                <p
                    style={{
                        ...revealDismissHint,
                        opacity: ready ? 0.5 : 0,
                        transition: ready ? "opacity 280ms ease" : "none",
                    }}
                >
                    {isReparations ? "This is yours now." : "Tap outside to dismiss"}
                </p>
                {ready && footer && <div style={{ width: "100%" }}>{footer}</div>}
            </div>
        </div>
    );
}
