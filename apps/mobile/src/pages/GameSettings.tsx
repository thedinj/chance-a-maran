import { IonButton, IonContent, IonFooter, IonPage } from "@ionic/react";
import { AppHeader } from "../components/AppHeader";
import React, { useState, useTransition } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useSession } from "../session/useSession";
import { apiClient } from "../lib/api";

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

export default function GameSettings() {
    const { sessionId } = useParams<{ sessionId?: string }>();
    const isEditMode = Boolean(sessionId);

    const { user, isInitializing } = useAuth();
    const { session, players, initSession } = useSession();
    const history = useHistory();
    const [isPending, startTransition] = useTransition();

    // Form state — seeded from existing session in edit mode
    const [name, setName] = useState(session?.name ?? "");
    const [drinking, setDrinking] = useState(session?.filterSettings.drinking ?? false);
    const [ageAppropriate, setAgeAppropriate] = useState(
        session?.filterSettings.ageAppropriate ?? false
    );
    const [gameTags, setGameTags] = useState<string[]>(session?.filterSettings.gameTags ?? []);
    const [tagInput, setTagInput] = useState("");
    // Card sharing default per UX spec — host's own setting for pool contribution
    // TODO: read from current player record once a getPlayer / updatePlayerSharing endpoint exists
    const [cardSharing, setCardSharing] = useState<"none" | "mine" | "network">("network");
    const [error, setError] = useState<string | null>(null);

    // Registered-only page
    if (!user) {
        if (!isInitializing) history.replace("/");
        return null;
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    function addTag() {
        const tag = tagInput.trim();
        if (tag && !gameTags.includes(tag)) {
            setGameTags((prev) => [...prev, tag]);
        }
        setTagInput("");
    }

    function removeTag(tag: string) {
        setGameTags((prev) => prev.filter((t) => t !== tag));
    }

    function handleSave() {
        setError(null);

        if (!isEditMode) {
            const trimmedName = name.trim();
            if (!trimmedName) {
                setError("Session name is required.");
                return;
            }
            startTransition(async () => {
                const result = await apiClient.createSession({
                    name: trimmedName,
                    filterSettings: { drinking, ageAppropriate, gameTags },
                });
                if (result.ok) {
                    const stateResult = await apiClient.getSessionState(result.data.id);
                    if (stateResult.ok) {
                        initSession(stateResult.data, result.data.hostPlayerId);
                    }
                    history.replace(`/game/${result.data.id}`);
                } else {
                    setError(result.error.message);
                }
            });
        } else {
            startTransition(async () => {
                const result = await apiClient.updateSessionFilters(sessionId!, {
                    drinking,
                    ageAppropriate,
                    gameTags,
                });
                if (result.ok) {
                    history.replace(`/game/${sessionId}`);
                } else {
                    setError(result.error.message);
                }
            });
        }
    }

    function handleCancel() {
        if (isEditMode) {
            history.replace(`/game/${sessionId}`);
        } else {
            history.replace("/");
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    {/* Page header */}
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={handleCancel} disabled={isPending}>
                            «
                        </button>
                        <h1 style={styles.heading}>{isEditMode ? "Game Settings" : "New Game"}</h1>
                    </div>

                    {/* ── Session name ────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>SESSION NAME</p>
                        {isEditMode ? (
                            <p style={styles.readOnlyValue}>{session?.name}</p>
                        ) : (
                            <input
                                style={styles.textInput}
                                placeholder="e.g. Friday Night Catan"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={60}
                                autoComplete="off"
                                disabled={isPending}
                            />
                        )}
                    </div>

                    <div style={styles.divider} />

                    {/* ── Filters ─────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>FILTERS</p>

                        <div style={styles.toggleRow}>
                            <div style={styles.toggleText}>
                                <span style={styles.toggleTitle}>Drinking cards</span>
                                <span style={styles.toggleSub}>
                                    Include cards with drinking mechanics
                                </span>
                            </div>
                            <button
                                style={drinking ? styles.toggleOn : styles.toggleOff}
                                onClick={() => setDrinking((v) => !v)}
                                disabled={isPending}
                            >
                                {drinking ? "ON" : "OFF"}
                            </button>
                        </div>

                        <div style={styles.rowDivider} />

                        <div style={styles.toggleRow}>
                            <div style={styles.toggleText}>
                                <span style={styles.toggleTitle}>Family safe only</span>
                                <span style={styles.toggleSub}>Exclude mature content</span>
                            </div>
                            <button
                                style={ageAppropriate ? styles.toggleOn : styles.toggleOff}
                                onClick={() => setAgeAppropriate((v) => !v)}
                                disabled={isPending}
                            >
                                {ageAppropriate ? "ON" : "OFF"}
                            </button>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* ── Game tags ────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>GAME</p>
                        <p style={styles.hint}>
                            Filter cards by the game you're playing. Leave empty for any game.
                        </p>

                        {gameTags.length > 0 && (
                            <div style={styles.tagList}>
                                {gameTags.map((tag) => (
                                    <button
                                        key={tag}
                                        style={styles.tagChip as React.CSSProperties}
                                        onClick={() => removeTag(tag)}
                                        disabled={isPending}
                                    >
                                        {tag} ×
                                    </button>
                                ))}
                            </div>
                        )}

                        <div style={styles.tagInputRow}>
                            <input
                                style={{ ...styles.textInput, flex: 1, minWidth: 0 }}
                                placeholder="Add a game"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                                maxLength={40}
                                disabled={isPending}
                            />
                            <button
                                style={
                                    tagInput.trim() && !isPending
                                        ? styles.addButton
                                        : styles.addButtonDisabled
                                }
                                onClick={addTag}
                                disabled={!tagInput.trim() || isPending}
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* ── Card sharing ─────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>YOUR CARDS</p>
                        <p style={styles.hint}>How much of your library enters the draw pool.</p>

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
                                        <div style={styles.radioLabel}>{SHARING_LABELS[level]}</div>
                                        <div style={styles.radioSub}>
                                            {SHARING_DESCRIPTIONS[level]}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Player list (edit mode only) ─────────────────────── */}
                    {isEditMode && players.length > 0 && (
                        <>
                            <div style={styles.divider} />
                            <div style={styles.section}>
                                <p style={styles.sectionLabel}>PLAYERS</p>
                                <div style={styles.playerList}>
                                    {players.map((player) => (
                                        <div key={player.id} style={styles.playerRow}>
                                            <span style={styles.playerName}>
                                                {player.displayName}
                                            </span>
                                            {player.userId === null ? (
                                                <button
                                                    style={styles.dangerLink as React.CSSProperties}
                                                    disabled={isPending}
                                                    // TODO: wire to PATCH /api/sessions/:id/players/:playerId { resetToken: true }
                                                    onClick={() => {}}
                                                >
                                                    Reset identity
                                                </button>
                                            ) : (
                                                <span style={styles.registeredBadge}>
                                                    REGISTERED
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {error && <p style={styles.error}>{error}</p>}
                </div>
            </IonContent>

            {/* Bottom-anchored save action */}
            <IonFooter>
                <div style={styles.footer}>
                    <IonButton
                        expand="block"
                        style={styles.saveButton as React.CSSProperties}
                        onClick={handleSave}
                        disabled={isPending}
                    >
                        {isEditMode ? "Save" : "Create game"}
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
    rowDivider: {
        height: "1px",
        backgroundColor: "var(--color-border)",
    },
    hint: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        lineHeight: 1.5,
    },

    // Session name
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
    readOnlyValue: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-subheading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        margin: 0,
    },

    // Toggles
    toggleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-4)",
    },
    toggleText: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        flex: 1,
    },
    toggleTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
    },
    toggleSub: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    toggleOff: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minWidth: "52px",
        minHeight: "44px",
        textAlign: "center",
    },
    toggleOn: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-amber)",
        color: "var(--color-accent-amber)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        padding: "var(--space-2) var(--space-3)",
        cursor: "pointer",
        minWidth: "52px",
        minHeight: "44px",
        textAlign: "center",
    },

    // Game tags
    tagList: {
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-2)",
    },
    tagChip: {
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        padding: "var(--space-1) var(--space-3)",
        cursor: "pointer",
        minHeight: "32px",
        display: "inline-flex",
        alignItems: "center",
    },
    tagInputRow: {
        display: "flex",
        gap: "var(--space-2)",
    },
    addButton: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        padding: "var(--space-2) var(--space-4)",
        cursor: "pointer",
        flexShrink: 0,
        minHeight: "44px",
    },
    addButtonDisabled: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-secondary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        padding: "var(--space-2) var(--space-4)",
        cursor: "default",
        flexShrink: 0,
        minHeight: "44px",
    },

    // Card sharing
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
        // Inner surface-colored ring creates the classic radio-selected look
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

    // Player list
    playerList: {
        display: "flex",
        flexDirection: "column",
    },
    playerRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) 0",
        borderBottom: "1px solid var(--color-border)",
        minHeight: "44px",
    },
    playerName: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
    },
    dangerLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        cursor: "pointer",
        padding: "var(--space-2) 0",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },
    registeredBadge: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.15em",
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
