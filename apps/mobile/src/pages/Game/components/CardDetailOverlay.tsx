import React, { useState } from "react";
import { AppDialog } from "../../../components/AppDialog";
import { FlippingCard } from "../../../components/GameCard";
import { hapticLight } from "../../../lib/haptics";
import { useGamePageContext } from "../GamePageContext";
import { styles } from "../styles";

export function CardDetailOverlay() {
    const {
        selectedCard: event,
        players,
        activePlayerId,
        pendingTransfers,
        setSelectedCard,
        handleVote,
        handleResolve,
        handleTransfer,
        handleCancelTransfer,
        handleShareDescription,
    } = useGamePageContext();

    const cv = event!.cardVersion;
    const isDrawer = event!.playerId === activePlayerId;
    const pendingTransfer = pendingTransfers.find((t) => t.drawEventId === event!.id) ?? null;

    const [voteDir, setVoteDir] = useState<"up" | "down" | null>(null);
    const [votePending, setVotePending] = useState(false);
    const [resolvePending, setResolvePending] = useState(false);
    const [showTransferPicker, setShowTransferPicker] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState<{
        toPlayerId: string;
        toPlayerName: string;
    } | null>(null);
    const [resolved, setResolved] = useState(event!.resolved);
    const [sharing, setSharing] = useState(false);
    const [sharedViaActionBar, setSharedViaActionBar] = useState(event!.descriptionShared);
    const [hasRevealed, setHasRevealed] = useState(
        !cv.hasHiddenInstructions || event!.descriptionShared
    );
    const [showRetractConfirm, setShowRetractConfirm] = useState(false);

    const showActionBarShareBtn =
        cv.hasHiddenInstructions && !sharedViaActionBar && isDrawer && hasRevealed;

    const pendingTargetName =
        players.find((p) => p.id === pendingTransfer?.toPlayerId)?.displayName ?? "player";

    async function handleVoteClick(dir: "up" | "down") {
        if (votePending) return;
        const next = voteDir === dir ? null : dir;
        setVoteDir(next);
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
        await handleResolve(event!.id, next);
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
        await handleTransfer(event!.id, toPlayerId);
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
        const ok = await handleShareDescription(event!.id);
        if (ok) setSharedViaActionBar(true);
        setSharing(false);
    }

    const transferablePlayers = players.filter((p) => p.id !== event!.playerId && p.active);

    return (
        <div style={styles.detailWrap as React.CSSProperties} onClick={() => setSelectedCard(null)}>
            <div style={styles.detailCardArea as React.CSSProperties}>
                <div
                    style={{ maxWidth: "430px", width: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <FlippingCard
                        event={event!}
                        overrideDuration={480}
                        onReveal={() => setHasRevealed(true)}
                    />
                </div>
            </div>

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
                <button style={styles.actionBtn as React.CSSProperties} onClick={() => handleVoteClick("up")} disabled={votePending}>
                    <span
                        style={{
                            ...(styles.actionIcon as React.CSSProperties),
                            color:
                                voteDir === "up"
                                    ? "var(--color-accent-amber)"
                                    : "var(--color-text-secondary)",
                        }}
                    >
                        ↑
                    </span>
                    <span style={styles.actionLabel as React.CSSProperties}>Up</span>
                </button>

                <button style={styles.actionBtn as React.CSSProperties} onClick={() => handleVoteClick("down")} disabled={votePending}>
                    <span
                        style={{
                            ...(styles.actionIcon as React.CSSProperties),
                            color:
                                voteDir === "down"
                                    ? "var(--color-danger)"
                                    : "var(--color-text-secondary)",
                        }}
                    >
                        ↓
                    </span>
                    <span style={styles.actionLabel as React.CSSProperties}>Down</span>
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
        </div>
    );
}
