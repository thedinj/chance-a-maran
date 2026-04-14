import React, { useEffect, useRef, useState } from "react";
import { apiClient } from "../lib/api";
import type { Card, CardVersion } from "../lib/api";
import { useSession } from "../session/useSession";
import { SCROLLBAR_CSS, SCROLLBAR_CLASS } from "../lib/scrollbars";
import { CARD_ASPECT_RATIO, CARD_IMAGE_ASPECT_RATIO } from "@chance/core";

// ── CardBack ──────────────────────────────────────────────────────────────────
interface CardBackProps {
    card: Card;
    cardVersion: CardVersion;
}

export function CardBack({ card, cardVersion }: CardBackProps): React.JSX.Element {
    const isReparations = card.cardType === "reparations";
    const imageUrl = cardVersion.imageId ? apiClient.resolveMediaUrl(cardVersion.imageId) : null;

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
            <span
                style={{
                    ...styles.cornerDiamond,
                    top: "2.9cqi",
                    left: "2.9cqi",
                    fontSize: "3.9cqi",
                }}
            >
                ◆
            </span>
            <span
                style={{
                    ...styles.cornerDiamond,
                    top: "2.9cqi",
                    right: "2.9cqi",
                    fontSize: "3.9cqi",
                }}
            >
                ◆
            </span>
            <span
                style={{
                    ...styles.cornerDiamond,
                    bottom: "2.9cqi",
                    left: "2.9cqi",
                    fontSize: "3.9cqi",
                }}
            >
                ◆
            </span>
            <span
                style={{
                    ...styles.cornerDiamond,
                    bottom: "2.9cqi",
                    right: "2.9cqi",
                    fontSize: "3.9cqi",
                }}
            >
                ◆
            </span>
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
function HiddenInstrDivider() {
    return (
        <div style={styles.hiddenInstrDivider}>
            <div style={styles.hiddenInstrDividerLine} />
            <span style={styles.hiddenInstrDividerLabel}>private</span>
            <div style={styles.hiddenInstrDividerLine} />
        </div>
    );
}

// Static card front face. Reads activePlayerId from SessionContext.
// Manages its own description reveal and share state.

interface CardFrontProps {
    card: Card;
    cardVersion: CardVersion;
    /** The player who holds this card. Compared to activePlayerId to determine isDrawer. */
    drawerId?: string;
    /** Whether the description has been shared with everyone. */
    descriptionShared?: boolean;
    /** Pass true while a flip animation is in flight to animate the sheen effect. */
    flipInFlight?: boolean;
    /** Flip duration in ms — syncs the sheen transition to the actual flip speed. */
    flipDurationMs?: number;
    /** When true: disables interactive description reveal/share. Used in carousel slots. */
    readOnly?: boolean;
    /** Called when the drawer taps "Tap to reveal" — lets the parent know reveal happened. */
    onReveal?: () => void;
}

export function CardFront({
    card,
    cardVersion: cv,
    drawerId,
    descriptionShared = false,
    flipInFlight = false,
    flipDurationMs = 1180,
    readOnly = false,
    onReveal,
}: CardFrontProps): React.JSX.Element {
    const isReparations = card.cardType === "reparations";
    const { activePlayerId } = useSession();

    const isDrawer = drawerId !== undefined && drawerId === activePlayerId;
    const [descrRevealed, setDescrRevealed] = useState(
        !cv.hasHiddenInstructions || descriptionShared
    );

    // Server sends hiddenInstructions only to the drawer — use as an extra confirmation gate.
    const showHiddenToggle =
        !readOnly &&
        cv.hasHiddenInstructions &&
        cv.hiddenInstructions !== null &&
        !descriptionShared &&
        isDrawer &&
        !descrRevealed;

    function handleReveal() {
        setDescrRevealed(true);
        onReveal?.();
    }

    return (
        <>
            <style>{SCROLLBAR_CSS}</style>
            <div
                style={{
                    ...styles.revealCard,
                    ...(isReparations ? styles.revealCardReparations : undefined),
                }}
            >
                <div
                    style={{
                        ...styles.revealFrontFrame,
                        ...(isReparations ? styles.revealFrontFrameReparations : undefined),
                    }}
                />
                <div
                    style={{
                        ...styles.revealFrontTopRule,
                        ...(isReparations ? styles.revealFrontTopRuleReparations : undefined),
                    }}
                />
                <span
                    style={{
                        ...styles.cornerDiamond,
                        top: "2.9cqi",
                        left: "2.9cqi",
                        fontSize: "3.9cqi",
                    }}
                >
                    ◆
                </span>
                <span
                    style={{
                        ...styles.cornerDiamond,
                        top: "2.9cqi",
                        right: "2.9cqi",
                        fontSize: "3.9cqi",
                    }}
                >
                    ◆
                </span>
                <span
                    style={{
                        ...styles.cornerDiamond,
                        bottom: "2.9cqi",
                        left: "2.9cqi",
                        fontSize: "3.9cqi",
                    }}
                >
                    ◆
                </span>
                <span
                    style={{
                        ...styles.cornerDiamond,
                        bottom: "2.9cqi",
                        right: "2.9cqi",
                        fontSize: "3.9cqi",
                    }}
                >
                    ◆
                </span>

                <div style={styles.revealCardContent}>
                    <div
                        style={{
                            ...styles.revealContentSheen,
                            transform: flipInFlight ? "translateX(105%)" : "translateX(-86%)",
                            opacity: flipInFlight ? 0.38 : 0,
                            transition: `transform ${flipDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1), opacity 120ms var(--ease)`,
                        }}
                    />
                    <div style={styles.revealCardContentBody}>
                        <div
                            style={{
                                ...styles.revealImageSlot,
                                ...(isReparations ? styles.revealImageSlotReparations : undefined),
                            }}
                        >
                            {cv.imageId ? (
                                <img
                                    src={apiClient.resolveMediaUrl(cv.imageId) ?? ""}
                                    alt={cv.title}
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        objectPosition: `center ${(cv.imageYOffset ?? 0.5) * 100}%`,
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
                        <p style={styles.revealHeroMeta}>{card.authorDisplayName}</p>

                        {readOnly ? (
                            // ── Carousel: both sections visible, each line-clamped ──
                            <>
                                <p
                                    style={{
                                        ...styles.revealDescription,
                                        ...styles.revealDescriptionReadOnly,
                                    }}
                                >
                                    {cv.description}
                                </p>
                                {cv.hasHiddenInstructions &&
                                    (descriptionShared ? (
                                        // Shared — everyone sees the text
                                        <div style={styles.hiddenInstrSection}>
                                            <HiddenInstrDivider />
                                            <p
                                                style={{
                                                    ...styles.hiddenInstrText,
                                                    ...styles.hiddenInstrTextReadOnly,
                                                }}
                                            >
                                                {cv.hiddenInstructions}
                                            </p>
                                        </div>
                                    ) : (
                                        // Not shared yet — always hidden in carousel
                                        <div style={styles.hiddenDescArea}>
                                            <span style={styles.hiddenDescLabel}>HIDDEN</span>
                                        </div>
                                    ))}
                            </>
                        ) : (
                            // ── Detail view: single scrollable container ──
                            <div style={styles.revealScrollArea} className={SCROLLBAR_CLASS}>
                                <p style={styles.revealDescription}>{cv.description}</p>

                                {cv.hasHiddenInstructions && (
                                    <div style={styles.hiddenInstrSection}>
                                        <HiddenInstrDivider />
                                        {descrRevealed ? (
                                            <p style={styles.hiddenInstrText}>
                                                {cv.hiddenInstructions}
                                            </p>
                                        ) : showHiddenToggle ? (
                                            <button
                                                style={styles.hiddenDescArea}
                                                onClick={handleReveal}
                                            >
                                                <span style={styles.hiddenDescLabel}>
                                                    Tap to reveal
                                                </span>
                                            </button>
                                        ) : (
                                            <div style={styles.hiddenDescArea}>
                                                <span style={styles.hiddenDescLabel}>HIDDEN</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
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
    card: Card;
    cardVersion: CardVersion;
    /** The player who holds this card. Forwarded to CardFront for drawer-specific UI. */
    drawerId?: string;
    /** Whether the description has been shared with everyone. Forwarded to CardFront. */
    descriptionShared?: boolean;
    /** Fires once when the flip animation completes. */
    onFlipComplete?: () => void;
    /** Override flip duration in ms. Default 1180ms. */
    overrideDuration?: number;
    /** Override CSS easing. Default expo-out. */
    overrideEasing?: string;
    /** Pre-flip hold time in ms. Default 120ms. */
    dramaDelayMs?: number;
    /** When true, suppress flip timers entirely. Flip starts when this transitions to false. */
    flipHeld?: boolean;
    /** Forwarded to CardFront — called when the drawer taps reveal. */
    onReveal?: () => void;
}

export function FlippingCard({
    card,
    cardVersion,
    drawerId,
    descriptionShared,
    onFlipComplete,
    overrideDuration,
    overrideEasing,
    dramaDelayMs,
    flipHeld,
    onReveal,
}: FlippingCardProps): React.JSX.Element {
    const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const flipDelayMs = prefersReducedMotion ? 0 : (dramaDelayMs ?? 120);
    const flipDurationMs = prefersReducedMotion ? 170 : (overrideDuration ?? 1180);
    const flipEasing = prefersReducedMotion
        ? "linear"
        : (overrideEasing ?? "cubic-bezier(0.16, 1, 0.3, 1)");

    const [flipStarted, setFlipStarted] = useState(false);
    const [flipComplete, setFlipComplete] = useState(false);
    const flipInFlight = flipStarted && !flipComplete;

    useEffect(() => {
        setFlipStarted(false);
        setFlipComplete(false);

        if (flipHeld) return;

        const startTimer = window.setTimeout(() => setFlipStarted(true), flipDelayMs);
        const doneTimer = window.setTimeout(
            () => setFlipComplete(true),
            flipDelayMs + flipDurationMs
        );

        return () => {
            window.clearTimeout(startTimer);
            window.clearTimeout(doneTimer);
        };
    }, [cardVersion.id, flipDelayMs, flipDurationMs, flipHeld]);

    const firedRef = useRef(false);
    useEffect(() => {
        firedRef.current = false;
    }, [cardVersion.id]);
    useEffect(() => {
        if (flipComplete && !firedRef.current) {
            firedRef.current = true;
            onFlipComplete?.();
        }
    }, [flipComplete, onFlipComplete]);

    return (
        <div style={styles.revealFlipScene}>
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
                    <CardBack card={card} cardVersion={cardVersion} />
                </div>

                {/* Front face — initially hidden (rotated 180deg away from viewer) */}
                <div style={{ ...styles.revealFlipFace, transform: "rotateY(180deg)" }}>
                    <CardFront
                        card={card}
                        cardVersion={cardVersion}
                        drawerId={drawerId}
                        descriptionShared={descriptionShared}
                        flipInFlight={flipInFlight}
                        flipDurationMs={flipDurationMs}
                        onReveal={onReveal}
                    />
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
        fontSize: "2.4cqi",
        color: "var(--color-border)",
        lineHeight: 1,
        pointerEvents: "none",
    },

    // Card back
    revealBackFace: {
        containerType: "inline-size",
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
    } as React.CSSProperties,
    revealBackFaceReparations: {
        backgroundImage: "url(/img/reparations.png)",
        aspectRatio: `${CARD_ASPECT_RATIO.width} / ${CARD_ASPECT_RATIO.height}`,
        boxShadow:
            "inset 0 0 0 1px color-mix(in srgb, var(--color-accent-reparations) 68%, var(--color-border) 32%), 0 28px 64px -28px color-mix(in srgb, var(--color-accent-reparations) 58%, transparent)",
    },
    revealBackFrame: {
        position: "absolute",
        inset: "3.4cqi",
        border: "1px solid color-mix(in srgb, var(--color-accent-amber) 52%, transparent)",
        clipPath:
            "polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)",
        pointerEvents: "none",
    },
    revealBackFrameReparations: {
        inset: "3.9cqi",
        border: "1px solid color-mix(in srgb, var(--color-accent-reparations) 74%, var(--color-border) 26%)",
    },
    revealBackLogo: {
        display: "none",
    },
    revealBackSub: {
        display: "none",
    },

    // Card front
    revealCard: {
        containerType: "inline-size",
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
    } as React.CSSProperties,
    revealFrontFrame: {
        position: "absolute",
        inset: "2.9cqi",
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
        height: "1cqi",
        background:
            "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-amber) 82%, transparent) 0%, color-mix(in srgb, var(--color-accent-amber) 45%, transparent) 100%)",
        zIndex: 1,
    },
    revealCardReparations: {
        boxShadow:
            "inset 0 0 0 1px var(--color-border), 0 24px 58px -24px color-mix(in srgb, var(--color-accent-reparations) 52%, transparent)",
    },
    revealFrontFrameReparations: {
        border: "1px solid color-mix(in srgb, var(--color-accent-reparations) 44%, transparent)",
    },
    revealFrontTopRuleReparations: {
        background:
            "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-reparations) 82%, transparent) 0%, color-mix(in srgb, var(--color-accent-reparations) 45%, transparent) 100%)",
    },
    revealImageSlotReparations: {
        border: "1px solid color-mix(in srgb, var(--color-accent-reparations) 38%, transparent)",
        background:
            "linear-gradient(160deg, color-mix(in srgb, var(--color-surface-elevated) 90%, var(--color-accent-reparations) 10%) 0%, color-mix(in srgb, var(--color-surface) 94%, var(--color-accent-primary) 6%) 100%)",
    },
    revealCardContent: {
        padding: "6.8cqi",
        display: "flex",
        flexDirection: "column",
        gap: "3.9cqi",
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
        gap: "3.9cqi",
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
        aspectRatio: `${CARD_IMAGE_ASPECT_RATIO.width} / ${CARD_IMAGE_ASPECT_RATIO.height}`,
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
        gap: "1.9cqi",
        overflow: "hidden",
    },
    revealImageEmblem: {
        fontFamily: "var(--font-display)",
        fontSize: "max(18px, 11cqi)",
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        color: "color-mix(in srgb, var(--color-accent-amber) 78%, var(--color-text-primary) 22%)",
        textShadow: "0 6px 18px color-mix(in srgb, var(--color-accent-amber) 40%, transparent)",
    },
    revealImageSlotLabel: {
        margin: 0,
        fontFamily: "var(--font-ui)",
        fontSize: "2.7cqi",
        fontWeight: 600,
        letterSpacing: "0.18em",
        color: "var(--color-text-secondary)",
    },
    revealHeroTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "max(18px, 9.5cqi)",
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
        fontSize: "2.7cqi",
        fontWeight: 600,
        color: "color-mix(in srgb, var(--color-text-secondary) 90%, var(--color-accent-amber) 10%)",
        margin: 0,
        letterSpacing: "0.16em",
    },
    // Scroll wrapper: takes up remaining flex space, scrolls both description + hidden section
    revealScrollArea: {
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        paddingRight: "1.9cqi",
        scrollBehavior: "smooth",
        WebkitOverflowScrolling: "touch",
        display: "flex",
        flexDirection: "column",
        gap: "3.9cqi",
    } as React.CSSProperties & { scrollbarWidth?: string; scrollbarColor?: string },
    revealDescription: {
        fontFamily: "var(--font-ui)",
        fontSize: "max(11px, 3.6cqi)",
        color: "var(--color-text-primary)",
        lineHeight: 1.5,
        margin: 0,
    },
    revealDescriptionReadOnly: {
        overflow: "hidden",
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: 3,
    } as React.CSSProperties,
    hiddenInstrSection: {
        display: "flex",
        flexDirection: "column",
        gap: "2.9cqi",
    },
    hiddenInstrDivider: {
        display: "flex",
        alignItems: "center",
        gap: "1.9cqi",
    },
    hiddenInstrDividerLine: {
        flex: 1,
        height: "1px",
        background: "color-mix(in srgb, var(--color-border) 60%, transparent)",
    },
    hiddenInstrDividerLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "2.9cqi",
        color: "var(--color-text-secondary)",
        letterSpacing: "0.12em",
        textTransform: "uppercase" as const,
        opacity: 0.7,
    },
    hiddenInstrText: {
        fontFamily: "var(--font-ui)",
        fontSize: "max(11px, 3.6cqi)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
        margin: 0,
        fontStyle: "italic",
    },
    hiddenInstrTextReadOnly: {
        overflow: "hidden",
        display: "-webkit-box",
        WebkitBoxOrient: "vertical" as const,
        WebkitLineClamp: 3,
    } as React.CSSProperties,
    hiddenDescArea: {
        background:
            "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-border) 30%, transparent) 0px, color-mix(in srgb, var(--color-border) 30%, transparent) 1px, transparent 1px, transparent 8px)",
        border: "1px solid var(--color-border)",
        padding: "4.9cqi",
        cursor: "pointer",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    hiddenDescLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "2.9cqi",
        color: "var(--color-text-secondary)",
        letterSpacing: "0.05em",
    },
    shareDescBtn: {
        background: "none",
        border: "1px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "2.7cqi",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "1.9cqi 3.9cqi",
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
};
