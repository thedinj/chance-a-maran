import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import React, { useState } from "react";
import { AppDialog } from "../../../components/AppDialog";
import { hapticLight } from "../../../lib/haptics";
import type { DrawEvent } from "../../../lib/api";
import { useGamePageContext } from "../useGamePageContext";
import { styles } from "../styles";

interface CardActionsProps {
    event: DrawEvent;
    onDismiss: () => void;
    /** Whether the drawer has already tapped "Tap to reveal" for hidden instructions. */
    hasRevealed?: boolean;
}

export function CardActions({ event, onDismiss, hasRevealed: hasRevealedProp }: CardActionsProps) {
    const {
        players,
        activePlayerId,
        pendingTransfers,
        handleVote,
        handleResolve,
        handleTransfer,
        handleCancelTransfer,
        handleShareDescription,
    } = useGamePageContext();

    const cv = event.cardVersion;
    const isDrawer = event.playerId === activePlayerId;
    const pendingTransfer = pendingTransfers.find((t) => t.drawEventId === event.id) ?? null;

    const prefersReducedMotion = useReducedMotion();
    const [voteDir, setVoteDir] = useState<"up" | "down" | null>(null);
    const [votePending, setVotePending] = useState(false);
    const [voteKey, setVoteKey] = useState(0);
    const [voteLabelDir, setVoteLabelDir] = useState<"up" | "down" | null>(null);
    const [resolvePending, setResolvePending] = useState(false);
    const [showTransferPicker, setShowTransferPicker] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState<{
        toPlayerId: string;
        toPlayerName: string;
    } | null>(null);
    const [resolved, setResolved] = useState(event.resolved);
    const [sharing, setSharing] = useState(false);
    const [sharedViaActionBar, setSharedViaActionBar] = useState(event.descriptionShared);
    const [showRetractConfirm, setShowRetractConfirm] = useState(false);

    // hasRevealed: controlled externally (via onCardReveal) or derived from card state
    const hasRevealed = hasRevealedProp ?? (!cv.hasHiddenInstructions || event.descriptionShared);

    const showActionBarShareBtn =
        cv.hasHiddenInstructions && !sharedViaActionBar && isDrawer && hasRevealed;

    const pendingTargetName =
        players.find((p) => p.id === pendingTransfer?.toPlayerId)?.displayName ?? "player";

    async function handleVoteClick(dir: "up" | "down") {
        if (votePending) return;
        const next = voteDir === dir ? null : dir;
        setVoteDir(next);
        if (next !== null) {
            setVoteKey((k) => k + 1);
            setVoteLabelDir(next);
            setTimeout(() => setVoteLabelDir(null), 650);
        }
        setVotePending(true);
        hapticLight();
        await handleVote(cv.cardId, next);
        setVotePending(false);
    }

    async function handleResolveClick() {
        setResolvePending(true);
        hapticLight();
        const next = !resolved;
        setResolved(next);
        await handleResolve(event.id, next);
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
        await handleTransfer(event.id, toPlayerId);
    }

    async function handleConfirmRetract() {
        if (!pendingTransfer) return;
        setConfirmTransfer(null);
        hapticLight();
        await handleCancelTransfer(pendingTransfer.id);
    }

    async function handleShare() {
        setSharing(true);
        hapticLight();
        const ok = await handleShareDescription(event.id);
        if (ok) setSharedViaActionBar(true);
        setSharing(false);
    }

    const transferablePlayers = players.filter((p) => p.id !== event.playerId && p.active);

    return (
        <>
            {showTransferPicker && (
                <div style={styles.transferPicker as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
                    <p style={styles.transferPickerLabel as React.CSSProperties}>TRANSFER TO</p>
                    {transferablePlayers.map((p) => (
                        <button
                            key={p.id}
                            style={styles.transferPlayerBtn as React.CSSProperties}
                            onClick={() => handlePickTransferTarget(p.id, p.displayName)}
                        >
                            {p.displayName}
                        </button>
                    ))}
                    <button
                        style={styles.transferCancelBtn as React.CSSProperties}
                        onClick={() => setShowTransferPicker(false)}
                    >
                        Cancel
                    </button>
                </div>
            )}

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

            <div style={styles.actionBar as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
                <button
                    style={{ ...(styles.actionBtn as React.CSSProperties), position: "relative" }}
                    onClick={() => handleVoteClick("up")}
                    disabled={votePending}
                >
                    <AnimatePresence>
                        {voteLabelDir === "up" && !prefersReducedMotion && (
                            <motion.span
                                key={voteKey}
                                initial={{ opacity: 0, y: 0 }}
                                animate={{ opacity: 1, y: -20 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    fontFamily: "var(--font-ui)",
                                    fontSize: "var(--text-caption)",
                                    fontWeight: 700,
                                    color: "var(--color-accent-amber)",
                                    pointerEvents: "none",
                                    zIndex: 10,
                                    lineHeight: 1,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                +1
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <motion.span
                        style={{
                            ...(styles.actionIcon as React.CSSProperties),
                            color: voteDir === "up" ? "var(--color-accent-amber)" : "var(--color-text-secondary)",
                        }}
                        animate={!prefersReducedMotion && voteDir === "up" ? { scale: [1, 1.6, 1] } : { scale: 1 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    >
                        ↑
                    </motion.span>
                    <span style={styles.actionLabel as React.CSSProperties}>Up</span>
                </button>

                <button
                    style={{ ...(styles.actionBtn as React.CSSProperties), position: "relative" }}
                    onClick={() => handleVoteClick("down")}
                    disabled={votePending}
                >
                    <AnimatePresence>
                        {voteLabelDir === "down" && !prefersReducedMotion && (
                            <motion.span
                                key={voteKey}
                                initial={{ opacity: 0, y: 0 }}
                                animate={{ opacity: 1, y: -20 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    fontFamily: "var(--font-ui)",
                                    fontSize: "var(--text-caption)",
                                    fontWeight: 700,
                                    color: "var(--color-danger)",
                                    pointerEvents: "none",
                                    zIndex: 10,
                                    lineHeight: 1,
                                    whiteSpace: "nowrap",
                                }}
                            >
                                −1
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <motion.span
                        style={{
                            ...(styles.actionIcon as React.CSSProperties),
                            color: voteDir === "down" ? "var(--color-danger)" : "var(--color-text-secondary)",
                        }}
                        animate={!prefersReducedMotion && voteDir === "down" ? { scale: [1, 1.6, 1] } : { scale: 1 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    >
                        {voteDir === "down" ? "🪦" : "↓"}
                    </motion.span>
                    <span
                        style={{
                            ...(styles.actionLabel as React.CSSProperties),
                            color: voteDir === "down" ? "var(--color-danger)" : undefined,
                            fontStyle: voteDir === "down" ? "italic" : undefined,
                        }}
                    >
                        {voteDir === "down" ? "Buried" : "Boo"}
                    </span>
                </button>

                <button style={styles.actionBtn as React.CSSProperties} onClick={handleResolveClick} disabled={resolvePending}>
                    <span
                        style={{
                            ...(styles.actionIcon as React.CSSProperties),
                            color: resolved
                                ? "var(--color-success)"
                                : "var(--color-text-secondary)",
                        }}
                    >
                        ✓
                    </span>
                    <span style={styles.actionLabel as React.CSSProperties}>{resolved ? "Resolved" : "Resolve"}</span>
                </button>

                {(pendingTransfer || transferablePlayers.length > 0) &&
                    (pendingTransfer ? (
                        <button
                            style={styles.actionBtn as React.CSSProperties}
                            onClick={() => setShowRetractConfirm(true)}
                        >
                            <span
                                style={{
                                    ...(styles.actionIcon as React.CSSProperties),
                                    color: "var(--color-accent-amber)",
                                }}
                            >
                                ⇄
                            </span>
                            <span
                                style={{
                                    ...(styles.actionLabel as React.CSSProperties),
                                    color: "var(--color-accent-amber)",
                                }}
                            >
                                Retract
                            </span>
                        </button>
                    ) : (
                        <button
                            style={styles.actionBtn as React.CSSProperties}
                            onClick={() => setShowTransferPicker((v) => !v)}
                        >
                            <span
                                style={{
                                    ...(styles.actionIcon as React.CSSProperties),
                                    color: "var(--color-text-secondary)",
                                }}
                            >
                                ⇄
                            </span>
                            <span style={styles.actionLabel as React.CSSProperties}>Transfer</span>
                        </button>
                    ))}

                {showActionBarShareBtn && (
                    <button style={styles.actionBtn as React.CSSProperties} onClick={handleShare} disabled={sharing}>
                        <span
                            style={{
                                ...(styles.actionIcon as React.CSSProperties),
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            ↗
                        </span>
                        <span style={styles.actionLabel as React.CSSProperties}>
                            {sharing ? "Sharing..." : "Share desc"}
                        </span>
                    </button>
                )}
            </div>

            <div style={{ display: "none" }} onClick={onDismiss} />
        </>
    );
}
