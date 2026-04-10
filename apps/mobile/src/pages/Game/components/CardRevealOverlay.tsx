import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlippingCard } from "../../../components/GameCard";
import { getAudio } from "../sounds";
import { styles } from "../styles";
import type { DrawDrama, RevealPhase } from "../types";
import { useGamePageContext } from "../GamePageContext";

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
// Pre-reveal tribunal sequence: scanner sweep → 3 staccato title-card flashes.
// Label is picked randomly from REPARATIONS_LABELS at mount.
// Calls onComplete when the sequence ends (~1750ms).

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
                                letterSpacing: "0.04em",
                                lineHeight: 1,
                                color: "rgb(220, 14, 14)",
                                WebkitTextStroke: "1.5px rgba(212, 168, 71, 0.4)",
                                WebkitTextFillColor: "rgb(220, 14, 14)",
                                opacity: p.opacity,
                                transform: `scale(${p.scale}) translateX(${p.x}px)`,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "85vw",
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

// ── CardRevealOverlay ─────────────────────────────────────────────────────────

export function CardRevealOverlay() {
    const { revealCard, revealDrama, players, onDismissReveal } = useGamePageContext();
    const event = revealCard!;
    const drama: DrawDrama | undefined = revealDrama ?? undefined;
    const onDismiss = onDismissReveal;
    const loopRef = useRef<HTMLAudioElement | null>(null);
    const isGameChanger = Boolean(event.cardVersion.isGameChanger);
    const isReparations = event.card.cardType === "reparations";
    const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const initialPhase: RevealPhase = isReparations
        ? "reparations-intro"
        : drama?.introSound
          ? "audio-intro"
          : "flipping";
    const [phase, setPhase] = useState<RevealPhase>(initialPhase);
    const [gcExiting, setGcExiting] = useState(false);

    // ── Intro sound (game changer drama.mp3) ─────────────────────────────────
    // Plays once during "audio-intro" phase. When it ends, advances to "flipping".
    useEffect(() => {
        if (phase !== "audio-intro" || !drama?.introSound) return;
        const audio = getAudio(drama.introSound);
        audio.loop = false;
        audio.onended = () => setGcExiting(true);
        audio.play().catch(() => {});
        return () => {
            audio.onended = null;
            audio.pause();
        };
    }, [phase, drama]);

    // ── Advance to "flipping" after gc logo exit animation ───────────────────
    useEffect(() => {
        if (!gcExiting) return;
        const t = setTimeout(() => setPhase("flipping"), 220);
        return () => clearTimeout(t);
    }, [gcExiting]);

    // ── Loop sound (drumroll) ────────────────────────────────────────────────
    // Plays during "flipping" and "reparations-intro" phases. For reparations,
    // starts on mount (within user gesture chain) and continues uninterrupted
    // through the intro into the flip. Cleanup pauses when phase → "revealed".
    const loopActive = phase === "flipping" || phase === "reparations-intro";
    useEffect(() => {
        if (!loopActive || !drama?.loopSound) return;
        const audio = getAudio(drama.loopSound);
        loopRef.current = audio;
        audio.loop = true;
        audio.play().catch(() => {});
        return () => {
            audio.pause();
            loopRef.current = null;
        };
    }, [loopActive, drama]);

    // ── Single intro sound during reparations intro + flip ───────────────────
    // For dramas with introSound but no loopSound, play the track once when
    // loopActive becomes true (reparations-intro phase). Continues uninterrupted
    // through the flip. backMs controls when the flip fires after phase → "flipping".
    useEffect(() => {
        if (!loopActive || !drama?.introSound || drama.loopSound) return;
        const audio = getAudio(drama.introSound);
        audio.loop = false;
        audio.play().catch(() => {});
        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [loopActive, drama]);

    // ── Early hit sound (standard draw) ─────────────────────────────────────
    // When hitSoundOffsetMs is set, fire the cymbal at that offset from "flipping"
    // phase start rather than waiting for the flip animation to complete.
    useEffect(() => {
        if (phase !== "flipping" || !drama?.hitSound || drama.hitSoundOffsetMs === undefined)
            return;
        const t = setTimeout(() => {
            loopRef.current?.pause();
            loopRef.current = null;
            getAudio(drama.hitSound!)
                .play()
                .catch(() => {});
        }, drama.hitSoundOffsetMs);
        return () => clearTimeout(t);
    }, [phase, drama]);

    const handleFlipComplete = useCallback(() => {
        setPhase("revealed");
        // Skip hitSound here if it was already scheduled via hitSoundOffsetMs.
        if (drama?.hitSound && drama.hitSoundOffsetMs === undefined)
            getAudio(drama.hitSound)
                .play()
                .catch(() => {});
    }, [drama]);

    // Reparations always goes to "flipping" — audio plays concurrently with backMs hold.
    const handleReparationsIntroDone = useCallback(() => {
        setPhase("flipping");
    }, []);

    if (phase === "reparations-intro") {
        return (
            <ReparationsIntroSequence
                onComplete={handleReparationsIntroDone}
            />
        );
    }

    const ready = phase === "revealed";
    const flipping = phase === "flipping";

    return (
        <div
            style={{ ...(styles.overlayBackdrop as React.CSSProperties), pointerEvents: ready ? "auto" : "none" }}
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
                    ...(styles.revealCardWrap as React.CSSProperties),
                    position: "relative",
                    pointerEvents: "auto",
                    zIndex: 1,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {isGameChanger && (phase === "audio-intro" || gcExiting) && (
                    <div style={styles.gcLogoWrap as React.CSSProperties}>
                        <img
                            src="/img/GameChanger.png"
                            alt=""
                            aria-hidden="true"
                            style={
                                prefersReduced
                                    ? { width: "100%", height: "auto", display: "block" }
                                    : gcExiting
                                      ? (styles.gcLogoImgExit as React.CSSProperties)
                                      : (styles.gcLogoImgEnter as React.CSSProperties)
                            }
                        />
                    </div>
                )}
                <FlippingCard
                    event={event}
                    dramaDelayMs={phase === "audio-intro" ? 0 : drama?.backMs}
                    overrideDuration={drama?.flipMs}
                    overrideEasing={drama?.flipEasing}
                    flipHeld={phase === "audio-intro"}
                    onFlipComplete={handleFlipComplete}
                />
                <p
                    style={{
                        ...(styles.revealDismissHint as React.CSSProperties),
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
