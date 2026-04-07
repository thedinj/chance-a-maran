import React, { useEffect, useState } from "react";
import { apiClient } from "../lib/api";
import type { DrawEvent } from "../lib/api";
import { useCards } from "../cards/useCards";
import { useSession } from "../session/useSession";
import { SCROLLBAR_CSS, SCROLLBAR_CLASS } from "../lib/scrollbars";

// ── CardBack ──────────────────────────────────────────────────────────────────
// Static card back face. Size the container; this fills it at 412:581 aspect ratio (or 433:609 for reparations cards).

interface CardBackProps {
    event: DrawEvent;
}

export function CardBack({ event }: CardBackProps): React.JSX.Element {
    const isReparations = event.card.cardType === "reparations";
    const imageUrl = event.cardVersion.imageId
        ? apiClient.resolveImageUrl(event.cardVersion.imageId)
        : null;

    return (
        <div
            style={{
                ...styles.revealBackFace,
                ...(isReparations ? styles.revealBackFaceReparations : undefined),
            }}
        >
            <div
                style={{
                    ...styles.revealBackFrame,
                    ...(isReparations ? styles.revealBackFrameReparations : undefined),
                }}
            />
            <span style={{ ...styles.cornerDiamond, top: 12, left: 12, fontSize: 16 }}>◆</span>
            <span style={{ ...styles.cornerDiamond, top: 12, right: 12, fontSize: 16 }}>◆</span>
            <span style={{ ...styles.cornerDiamond, bottom: 12, left: 12, fontSize: 16 }}>◆</span>
            <span style={{ ...styles.cornerDiamond, bottom: 12, right: 12, fontSize: 16 }}>◆</span>
            <div style={styles.revealBackLogo}>C</div>
            <p style={styles.revealBackSub}>CHANCE</p>
            {imageUrl && (
                <img
                    src={imageUrl}
                    alt=""
                    aria-hidden="true"
                    style={{ display: "none" }}
                    fetchPriority="low"
                />
            )}
        </div>
    );
}

// ── CardFront ─────────────────────────────────────────────────────────────────
// Static card front face. Reads activePlayerId from SessionContext.
// Manages its own description reveal and share state.

interface CardFrontProps {
    event: DrawEvent;
    /** Pass true while a flip animation is in flight to animate the sheen effect. */
    flipInFlight?: boolean;
    /** When true: disables interactive description reveal/share. Used in carousel slots. */
    readOnly?: boolean;
}

export function CardFront({
    event,
    flipInFlight = false,
    readOnly = false,
}: CardFrontProps): React.JSX.Element {
    const cv = event.cardVersion;
    const { activePlayerId } = useSession();
    const { updateDrawEvent } = useCards();

    const isDrawer = event.playerId === activePlayerId;
    const [descriptionShared, setDescriptionShared] = useState(event.descriptionShared);
    const [descrRevealed, setDescrRevealed] = useState(
        !cv.hiddenDescription || event.descriptionShared
    );
    const [sharing, setSharing] = useState(false);

    const showHiddenToggle =
        !readOnly && cv.hiddenDescription && !descriptionShared && isDrawer && !descrRevealed;
    const showShareBtn =
        !readOnly && cv.hiddenDescription && !descriptionShared && isDrawer && descrRevealed;

    async function handleShare() {
        setSharing(true);
        const result = await apiClient.shareDescription(event.id);
        if (result.ok) {
            updateDrawEvent(result.data);
            setDescriptionShared(true);
        }
        setSharing(false);
    }

    return (
        <>
            <style>{SCROLLBAR_CSS}</style>
            <div style={styles.revealCard}>
                <div style={styles.revealFrontFrame} />
                <div style={styles.revealFrontTopRule} />
                <span style={{ ...styles.cornerDiamond, top: 12, left: 12, fontSize: 16 }}>◆</span>
                <span style={{ ...styles.cornerDiamond, top: 12, right: 12, fontSize: 16 }}>◆</span>
                <span style={{ ...styles.cornerDiamond, bottom: 12, left: 12, fontSize: 16 }}>
                    ◆
                </span>
                <span style={{ ...styles.cornerDiamond, bottom: 12, right: 12, fontSize: 16 }}>
                    ◆
                </span>

                <div style={styles.revealCardContent}>
                    <div
                        style={{
                            ...styles.revealContentSheen,
                            transform: flipInFlight ? "translateX(105%)" : "translateX(-86%)",
                            opacity: flipInFlight ? 0.38 : 0,
                            transition:
                                "transform 1180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 120ms var(--ease)",
                        }}
                    />
                    <div style={styles.revealCardContentBody}>
                        <div style={styles.revealImageSlot}>
                            {cv.imageId ? (
                                <img
                                    src={apiClient.resolveImageUrl(cv.imageId) ?? ""}
                                    alt={cv.title}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                    }}
                                />
                            ) : (
                                <>
                                    <div style={styles.revealImageEmblem}>C</div>
                                    <p style={styles.revealImageSlotLabel}>
                                        Consider yourself warned.
                                    </p>
                                </>
                            )}
                        </div>

                        <p style={styles.revealHeroTitle}>{cv.title}</p>
                        <p style={styles.revealHeroMeta}>{cv.authorDisplayName}</p>

                        {descrRevealed ? (
                            <p
                                style={{
                                    ...styles.revealDescription,
                                    ...(readOnly ? styles.revealDescriptionReadOnly : undefined),
                                }}
                                className={readOnly ? undefined : SCROLLBAR_CLASS}
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
                        ) : readOnly && cv.hiddenDescription && !descriptionShared ? (
                            <div style={styles.hiddenDescArea}>
                                <span style={styles.hiddenDescLabel}>HIDDEN</span>
                            </div>
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
            </div>
        </>
    );
}

// ── FlippingCard ──────────────────────────────────────────────────────────────
// Animated back→front flip. Composes CardBack and CardFront.

interface FlippingCardProps {
    event: DrawEvent;
    /** Fires once when the flip animation completes. */
    onFlipComplete?: () => void;
    /** Override flip duration in ms — bypasses isGameChanger timing and sets delay to 0. */
    overrideDuration?: number;
    /** Explicit pre-flip hold time in ms. Takes precedence over overrideDuration's implicit 0-delay. */
    dramaDelayMs?: number;
}

export function FlippingCard({
    event,
    onFlipComplete,
    overrideDuration,
    dramaDelayMs,
}: FlippingCardProps): React.JSX.Element {
    const cv = event.cardVersion;
    const isGameChanger = Boolean(cv.isGameChanger);
    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const flipDelayMs = prefersReducedMotion
        ? 0
        : dramaDelayMs != null
          ? dramaDelayMs
          : overrideDuration != null
            ? 0
            : isGameChanger
              ? 1100
              : 120;
    const flipDurationMs = prefersReducedMotion
        ? 170
        : (overrideDuration ?? (isGameChanger ? 2400 : 1180));
    const flipEasing = prefersReducedMotion
        ? "linear"
        : isGameChanger
          ? "cubic-bezier(0.22, 1, 0.36, 1)"
          : "cubic-bezier(0.16, 1, 0.3, 1)";

    const [flipStarted, setFlipStarted] = useState(false);
    const [flipComplete, setFlipComplete] = useState(false);
    const flipInFlight = flipStarted && !flipComplete;

    useEffect(() => {
        setFlipStarted(false);
        setFlipComplete(false);

        const startTimer = window.setTimeout(() => setFlipStarted(true), flipDelayMs);
        const doneTimer = window.setTimeout(
            () => setFlipComplete(true),
            flipDelayMs + flipDurationMs
        );

        return () => {
            window.clearTimeout(startTimer);
            window.clearTimeout(doneTimer);
        };
    }, [event.id, flipDelayMs, flipDurationMs]);

    useEffect(() => {
        if (flipComplete) onFlipComplete?.();
    }, [flipComplete, onFlipComplete]);

    return (
        <div style={styles.revealFlipScene}>
            {isGameChanger && !flipComplete && (
                <div style={styles.gameChangerBadge}>GAME CHANGER</div>
            )}

            <div
                style={{
                    ...styles.revealFlipShadow,
                    transform: flipInFlight
                        ? "scaleX(0.58) scaleY(0.86) translateY(2px)"
                        : "scaleX(0.96) scaleY(1)",
                    opacity: flipInFlight ? 0.62 : 0.36,
                    transition: `transform ${flipDurationMs}ms ${flipEasing}, opacity 180ms linear`,
                }}
            />

            <div
                style={{
                    ...styles.revealFlipInner,
                    transform: flipStarted
                        ? "rotateY(180deg) rotateX(0deg) scale(1)"
                        : "rotateY(0deg) rotateX(-3deg) scale(0.94)",
                    transition: `transform ${flipDurationMs}ms ${flipEasing}`,
                }}
            >
                {/* Back face — initially visible */}
                <div style={styles.revealFlipFace}>
                    <CardBack event={event} />
                </div>

                {/* Front face — initially hidden (rotated 180deg away from viewer) */}
                <div style={{ ...styles.revealFlipFace, transform: "rotateY(180deg)" }}>
                    <CardFront event={event} flipInFlight={flipInFlight} />
                </div>
            </div>
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    // NOTE: intentional copy of cornerDiamond — see also Game.tsx styles.cornerDiamond
    cornerDiamond: {
        position: "absolute",
        fontSize: 10,
        color: "var(--color-border)",
        lineHeight: 1,
        pointerEvents: "none",
    },

    // Card back
    revealBackFace: {
        backgroundImage: "url(/img/card.png)",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "transparent",
        aspectRatio: "412 / 581",
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
        boxShadow:
            "inset 0 0 0 1px var(--color-border), 0 24px 52px -26px color-mix(in srgb, var(--color-accent-amber) 48%, transparent)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        position: "relative",
    },
    revealBackFaceReparations: {
        backgroundImage: "url(/img/reparations.png)",
        aspectRatio: "433 / 609",
        boxShadow:
            "inset 0 0 0 1px color-mix(in srgb, var(--color-accent-amber) 68%, var(--color-border) 32%), 0 28px 64px -28px color-mix(in srgb, var(--color-accent-amber) 58%, transparent)",
    },
    revealBackFrame: {
        position: "absolute",
        inset: "14px",
        border: "1px solid color-mix(in srgb, var(--color-accent-amber) 52%, transparent)",
        clipPath:
            "polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)",
        pointerEvents: "none",
    },
    revealBackFrameReparations: {
        inset: "16px",
        border: "1px solid color-mix(in srgb, var(--color-accent-amber) 74%, var(--color-border) 26%)",
    },
    revealBackLogo: {
        display: "none",
    },
    revealBackSub: {
        display: "none",
    },

    // Card front
    revealCard: {
        background: "var(--color-surface)",
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
        boxShadow:
            "inset 0 0 0 1px var(--color-border), 0 24px 58px -24px color-mix(in srgb, var(--color-accent-amber) 52%, transparent)",
        aspectRatio: "412 / 581",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
    },
    revealFrontFrame: {
        position: "absolute",
        inset: "12px",
        border: "1px solid color-mix(in srgb, var(--color-accent-amber) 44%, transparent)",
        clipPath:
            "polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)",
        pointerEvents: "none",
        zIndex: 1,
    },
    revealFrontTopRule: {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "4px",
        background:
            "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-amber) 82%, transparent) 0%, color-mix(in srgb, var(--color-accent-amber) 45%, transparent) 100%)",
        zIndex: 1,
    },
    revealCardContent: {
        padding: "calc(var(--space-6) + var(--space-1))",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        position: "relative",
        zIndex: 2,
        overflow: "hidden",
        flex: 1,
        minHeight: 0,
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
    },
    revealCardContentBody: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        position: "relative",
        zIndex: 1,
        minHeight: 0,
        flex: 1,
    },
    revealContentSheen: {
        position: "absolute",
        inset: "1px",
        zIndex: 0,
        pointerEvents: "none",
        background:
            "linear-gradient(102deg, transparent 0%, transparent 36%, color-mix(in srgb, var(--color-text-primary) 42%, transparent) 47%, color-mix(in srgb, var(--color-text-primary) 28%, transparent) 54%, transparent 64%, transparent 100%)",
        opacity: 0,
    },
    revealImageSlot: {
        width: "100%",
        aspectRatio: "16 / 9",
        border: "1px solid color-mix(in srgb, var(--color-accent-amber) 38%, transparent)",
        background:
            "linear-gradient(160deg, color-mix(in srgb, var(--color-surface-elevated) 90%, var(--color-accent-amber) 10%) 0%, color-mix(in srgb, var(--color-surface) 94%, var(--color-accent-primary) 6%) 100%)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-border) 80%, transparent)",
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-2)",
        overflow: "hidden",
    },
    revealImageEmblem: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(44px, 12vw, 62px)",
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        color: "color-mix(in srgb, var(--color-accent-amber) 78%, var(--color-text-primary) 22%)",
        textShadow: "0 6px 18px color-mix(in srgb, var(--color-accent-amber) 40%, transparent)",
    },
    revealImageSlotLabel: {
        margin: 0,
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 600,
        letterSpacing: "0.18em",
        color: "var(--color-text-secondary)",
    },
    revealHeroTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(34px, 9vw, 46px)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.025em",
        lineHeight: 1.06,
        margin: 0,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: 2,
        overflow: "hidden",
        textOverflow: "ellipsis",
    } as React.CSSProperties,
    revealHeroMeta: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 600,
        color: "color-mix(in srgb, var(--color-text-secondary) 90%, var(--color-accent-amber) 10%)",
        margin: 0,
        letterSpacing: "0.16em",
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
    } as React.CSSProperties & { scrollbarWidth?: string; scrollbarColor?: string },
    revealDescriptionReadOnly: {
        overflow: "hidden",
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: 4,
        paddingRight: 0,
    } as React.CSSProperties,
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

    // Flip scene
    revealFlipScene: {
        width: "100%",
        perspective: "920px",
        position: "relative",
        isolation: "isolate",
    },
    revealFlipInner: {
        width: "100%",
        display: "grid",
        transformStyle: "preserve-3d",
        transformOrigin: "50% 50%",
        transform: "rotateY(0deg) rotateX(0deg) translateZ(0px)",
        willChange: "transform",
        position: "relative",
        zIndex: 1,
    },
    revealFlipShadow: {
        position: "absolute",
        left: "6%",
        width: "88%",
        bottom: "-14px",
        height: "36px",
        borderRadius: "50%",
        background: "color-mix(in srgb, var(--color-bg) 90%, transparent)",
        filter: "blur(9px)",
        opacity: 0.44,
        transformOrigin: "50% 50%",
        zIndex: 0,
        pointerEvents: "none",
    },
    revealFlipFace: {
        gridArea: "1 / 1",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
    },

    // Game changer badge
    gameChangerBadge: {
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
    },
};
