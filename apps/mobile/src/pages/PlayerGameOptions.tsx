import { IonButton, IonContent, IonFooter, IonPage } from "@ionic/react";
import React, { useState, useTransition } from "react";
import { useHistory, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { apiClient } from "../lib/api";
import { useSession } from "../session/useSession";

// ─── Card sharing copy ────────────────────────────────────────────────────────

const SHARING_LABELS: Record<"none" | "mine" | "network", string> = {
    network: "My network",
    mine: "My cards",
    none: "None",
};

const SHARING_DESCRIPTIONS: Record<"none" | "mine" | "network", string> = {
    network: "Your cards + cards from players in your recent sessions",
    mine: "Your own library cards only",
    none: "Don't contribute cards to this session",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlayerGameOptions() {
    const { playerId } = useParams<{ sessionId: string; playerId: string }>();
    const { session, players, devicePlayerIds, updateLocalPlayer } = useSession();
    const history = useHistory();
    const [isPending, startTransition] = useTransition();

    const targetPlayer = players.find((p) => p.id === playerId) ?? null;

    const [displayName, setDisplayName] = useState(targetPlayer?.displayName ?? "");
    const [cardSharing, setCardSharing] = useState<"none" | "mine" | "network">(
        targetPlayer?.cardSharing ?? "network"
    );
    const [error, setError] = useState<string | null>(null);

    // Guard: must be in an active session, target must be a non-host device player
    if (!session || !targetPlayer || !devicePlayerIds.includes(targetPlayer.id)) {
        history.replace("/");
        return null;
    }
    if (targetPlayer.id === session.hostPlayerId) {
        history.replace(`/game-settings/${session.id}`);
        return null;
    }

    // Capture after guards so closures hold non-null references
    const currentSession = session;
    const currentPlayer = targetPlayer;

    const isRegistered = currentPlayer.userId !== null;

    const hasChanges =
        displayName.trim() !== currentPlayer.displayName ||
        (isRegistered && cardSharing !== currentPlayer.cardSharing);

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleSave() {
        const trimmedName = displayName.trim();
        if (!trimmedName) {
            setError("Name cannot be empty.");
            return;
        }
        setError(null);

        const patch: { displayName?: string; cardSharing?: "none" | "mine" | "network" } = {};
        if (trimmedName !== currentPlayer.displayName) patch.displayName = trimmedName;
        if (isRegistered && cardSharing !== currentPlayer.cardSharing) patch.cardSharing = cardSharing;

        startTransition(async () => {
            const result = await apiClient.updatePlayerSettings(
                currentSession.id,
                currentPlayer.id,
                patch
            );
            if (result.ok) {
                updateLocalPlayer(currentPlayer.id, patch);
                history.replace(`/game/${currentSession.id}`);
            } else {
                setError(result.error.message);
            }
        });
    }

    function handleCancel() {
        history.replace(`/game/${currentSession.id}`);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <IonPage>
            <AppHeader />
            <IonContent style={{ "--background": "var(--color-bg)" } as React.CSSProperties}>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={handleCancel}>
                            ←
                        </button>
                        <h1 style={styles.heading}>Game Options</h1>
                    </div>

                    {/* ── Display name ─────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>YOUR NAME</p>
                        <input
                            style={styles.textInput}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            maxLength={30}
                            placeholder="Your name"
                            disabled={isPending}
                        />
                    </div>

                    {/* ── Card sharing (registered players only) ───────────── */}
                    {isRegistered && (
                        <>
                            <div style={styles.divider} />
                            <div style={styles.section}>
                                <p style={styles.sectionLabel}>YOUR CARDS</p>
                                <p style={styles.hint}>
                                    How much of your library enters the draw pool.
                                </p>
                                <div style={styles.radioStack}>
                                    {(["network", "mine", "none"] as const).map((level) => (
                                        <button
                                            key={level}
                                            style={
                                                (cardSharing === level
                                                    ? styles.radioRowSelected
                                                    : styles.radioRow) as React.CSSProperties
                                            }
                                            onClick={() => setCardSharing(level)}
                                            disabled={isPending}
                                        >
                                            <div
                                                style={
                                                    cardSharing === level
                                                        ? styles.radioDotActive
                                                        : styles.radioDot
                                                }
                                            />
                                            <div>
                                                <div style={styles.radioLabel}>
                                                    {SHARING_LABELS[level]}
                                                </div>
                                                <div style={styles.radioSub}>
                                                    {SHARING_DESCRIPTIONS[level]}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {error && <p style={styles.error}>{error}</p>}
                </div>
            </IonContent>

            <IonFooter>
                <div style={styles.footer}>
                    <IonButton
                        expand="block"
                        style={styles.saveButton as React.CSSProperties}
                        onClick={handleSave}
                        disabled={!hasChanges || isPending}
                    >
                        Save
                    </IonButton>
                    <button style={styles.cancelLink} onClick={handleCancel} disabled={isPending}>
                        Cancel
                    </button>
                </div>
            </IonFooter>
        </IonPage>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingBottom: "var(--space-8)",
    },

    // Header
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

    // Section layout
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
    hint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
    },

    // Display name input
    textInput: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        padding: "var(--space-3) var(--space-4)",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
    },

    // Card sharing radios
    radioStack: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    radioRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        padding: "var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
    },
    radioRowSelected: {
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-primary)",
        padding: "var(--space-4)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
    },
    radioDot: {
        width: "16px",
        height: "16px",
        border: "1.5px solid var(--color-border)",
        borderRadius: "50%",
        flexShrink: 0,
        marginTop: "2px",
        boxSizing: "border-box",
        background: "none",
    },
    radioDotActive: {
        width: "16px",
        height: "16px",
        border: "1.5px solid var(--color-accent-primary)",
        borderRadius: "50%",
        flexShrink: 0,
        marginTop: "2px",
        boxSizing: "border-box",
        background: "var(--color-accent-primary)",
        boxShadow: "inset 0 0 0 3px var(--color-surface)",
    },
    radioLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        color: "var(--color-text-primary)",
        marginBottom: "var(--space-1)",
    },
    radioSub: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
    },

    // Error
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "0 var(--space-5) var(--space-3)",
    },

    // Footer
    footer: {
        backgroundColor: "var(--color-bg)",
        borderTop: "1px solid var(--color-border)",
        padding: "var(--space-4) var(--space-5)",
        paddingBottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    saveButton: {
        "--background": "var(--color-surface)",
        "--border-color": "var(--color-accent-primary)",
        "--border-width": "1.5px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        "--min-height": "56px",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    cancelLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "var(--space-2)",
        textAlign: "center",
        alignSelf: "center",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },
};
