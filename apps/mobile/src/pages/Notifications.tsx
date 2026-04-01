import { IonContent, IonPage } from "@ionic/react";
import React, { useTransition } from "react";
import { useHistory } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { apiClient } from "../lib/api";
import { useCards } from "../cards/useCards";
import { useSession } from "../session/useSession";
import { useTransfers } from "../transfers/useTransfers";

// ─── Component ───────────────────────────────────────────────────────────────

export default function Notifications() {
    const { session, players, devicePlayerIds } = useSession();
    const { drawHistory, addDrawEvent, removeDrawEvent } = useCards();
    const { pendingTransfers, removeTransfer } = useTransfers();
    const history = useHistory();

    if (!session) {
        history.replace("/");
        return null;
    }

    const currentSession = session;

    // Incoming transfers for device players only
    const incomingTransfers = pendingTransfers.filter((t) =>
        devicePlayerIds.includes(t.toPlayerId)
    );

    function handleBack() {
        history.replace(`/game/${currentSession.id}`);
    }

    return (
        <IonPage>
            <AppHeader />
            <IonContent style={{ "--background": "var(--color-bg)" } as React.CSSProperties}>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={handleBack}>
                            ←
                        </button>
                        <h1 style={styles.heading}>Notifications</h1>
                    </div>

                    {/* ── Game section ──────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>THIS GAME</p>

                        {incomingTransfers.length === 0 ? (
                            <p style={styles.emptyHint}>No pending notifications.</p>
                        ) : (
                            <div style={styles.transferList}>
                                {incomingTransfers.map((transfer) => {
                                    const cardTitle =
                                        drawHistory.find((e) => e.id === transfer.drawEventId)
                                            ?.cardVersion.title ?? "A card";
                                    const fromName =
                                        players.find((p) => p.id === transfer.fromPlayerId)
                                            ?.displayName ?? "Someone";
                                    const toName =
                                        players.find((p) => p.id === transfer.toPlayerId)
                                            ?.displayName ?? "You";
                                    return (
                                        <TransferItem
                                            key={transfer.id}
                                            transferId={transfer.id}
                                            drawEventId={transfer.drawEventId}
                                            cardTitle={cardTitle}
                                            fromName={fromName}
                                            toName={toName}
                                            sessionId={currentSession.id}
                                            onRemoveTransfer={removeTransfer}
                                            onRemoveDrawEvent={removeDrawEvent}
                                            onAddDrawEvent={addDrawEvent}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div style={styles.divider} />

                    {/* ── Global section (stub) ─────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>GLOBAL</p>
                        <p style={styles.emptyHint}>Coming soon.</p>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
}

// ─── TransferItem ─────────────────────────────────────────────────────────────

interface TransferItemProps {
    transferId: string;
    drawEventId: string;
    cardTitle: string;
    fromName: string;
    toName: string;
    sessionId: string;
    onRemoveTransfer(transferId: string): void;
    onRemoveDrawEvent(drawEventId: string): void;
    onAddDrawEvent(event: import("../lib/api").DrawEvent): void;
}

function TransferItem({
    transferId,
    drawEventId,
    cardTitle,
    fromName,
    toName,
    onRemoveTransfer,
    onRemoveDrawEvent,
    onAddDrawEvent,
}: TransferItemProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = React.useState<string | null>(null);

    function handleAccept() {
        setError(null);
        startTransition(async () => {
            const result = await apiClient.acceptTransfer(transferId);
            if (result.ok) {
                onRemoveDrawEvent(drawEventId);
                onAddDrawEvent(result.data);
                onRemoveTransfer(transferId);
            } else {
                setError(result.error.message);
            }
        });
    }

    function handleDecline() {
        setError(null);
        startTransition(async () => {
            const result = await apiClient.cancelTransfer(transferId);
            if (result.ok) {
                onRemoveTransfer(transferId);
            } else {
                setError(result.error.message);
            }
        });
    }

    return (
        <div style={styles.transferItem}>
            <div style={styles.transferMeta}>
                <p style={styles.transferTitle}>{cardTitle}</p>
                <p style={styles.transferDesc}>
                    {fromName} → {toName}
                </p>
            </div>
            <div style={styles.transferActions}>
                <button
                    style={styles.acceptBtn}
                    onClick={handleAccept}
                    disabled={isPending}
                >
                    Accept
                </button>
                <button
                    style={styles.declineBtn}
                    onClick={handleDecline}
                    disabled={isPending}
                >
                    Decline
                </button>
            </div>
            {error && <p style={styles.error}>{error}</p>}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingBottom: "var(--space-8)",
    },

    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "0 var(--space-5) var(--space-5)",
    },
    backLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
        minHeight: "44px",
        minWidth: "44px",
        display: "flex",
        alignItems: "center",
    },
    heading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
    },

    section: {
        padding: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    sectionLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
        margin: 0,
    },
    divider: {
        height: "1px",
        backgroundColor: "var(--color-border)",
        margin: "0 var(--space-5)",
    },
    emptyHint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
    },

    transferList: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    transferItem: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    transferMeta: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
    },
    transferTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        margin: 0,
        letterSpacing: "-0.01em",
    },
    transferDesc: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    transferActions: {
        display: "flex",
        gap: "var(--space-3)",
    },
    acceptBtn: {
        flex: 1,
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-primary)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-3)",
        cursor: "pointer",
        minHeight: "44px",
    },
    declineBtn: {
        flex: 1,
        background: "none",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        padding: "var(--space-3)",
        cursor: "pointer",
        minHeight: "44px",
    },
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
    },
};
