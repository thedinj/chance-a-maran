import { IonButton, IonContent, IonFooter, IonPage } from "@ionic/react";
import { AppHeader } from "../components/AppHeader";
import React, { useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useSession } from "../session/useSession";
import { apiClient } from "../lib/api";

// ─── Component ───────────────────────────────────────────────────────────────

export default function SubmitCard() {
    const { user, isInitializing } = useAuth();
    const { session } = useSession();
    const history = useHistory();
    const [isPending, startTransition] = useTransition();

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [hiddenDescription, setHiddenDescription] = useState(false);
    const [drinksPerHourThisPlayer, setDrinksPerHourThisPlayer] = useState(0);
    const [avgDrinksPerHourAllPlayers, setAvgDrinksPerHourAllPlayers] = useState(0);
    const [isFamilySafe, setIsFamilySafe] = useState(false);
    const [isGameChanger, setIsGameChanger] = useState(false);
    const [gameTags, setGameTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
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

    function handleSubmit() {
        setError(null);

        const trimmedTitle = title.trim();
        const trimmedDescription = description.trim();

        if (!trimmedTitle) {
            setError("Title is required.");
            return;
        }
        if (!trimmedDescription) {
            setError("Description is required.");
            return;
        }

        const req = {
            title: trimmedTitle,
            description: trimmedDescription,
            hiddenDescription,
            drinksPerHourThisPlayer,
            avgDrinksPerHourAllPlayers,
            isFamilySafe,
            isGameChanger,
            gameTags,
        };

        startTransition(async () => {
            const result = session
                ? await apiClient.submitCard(session.id, req)
                : await apiClient.submitCardOutsideSession(req);

            if (result.ok) {
                history.goBack();
            } else {
                setError(result.error.message);
            }
        });
    }

    function handleCancel() {
        history.goBack();
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
                        <h1 style={styles.heading}>Submit card</h1>
                    </div>

                    {/* ── Card content ────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>CARD CONTENT</p>

                        <input
                            style={styles.textInput}
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={80}
                            autoComplete="off"
                            disabled={isPending}
                        />

                        <textarea
                            style={styles.textArea}
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={500}
                            disabled={isPending}
                            rows={4}
                        />

                        <div style={styles.rowDivider} />

                        <div style={styles.toggleRow}>
                            <div style={styles.toggleText}>
                                <span style={styles.toggleTitle}>Hidden description</span>
                                <span style={styles.toggleSub}>
                                    Only the drawing player sees this initially
                                </span>
                            </div>
                            <button
                                style={hiddenDescription ? styles.toggleOn : styles.toggleOff}
                                onClick={() => setHiddenDescription((v) => !v)}
                                disabled={isPending}
                            >
                                {hiddenDescription ? "ON" : "OFF"}
                            </button>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* ── Drinking ─────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>DRINKING</p>
                        <p style={styles.hint}>
                            Estimated drinks per hour this card adds. Leave at 0 for non-drinking
                            cards — these pass the session drinking filter regardless.
                        </p>

                        <div style={styles.numberRow}>
                            <label style={styles.numberLabel}>
                                <span style={styles.numberLabelText}>Drinks / hr (you)</span>
                                <input
                                    type="number"
                                    style={styles.numberInput}
                                    value={drinksPerHourThisPlayer}
                                    min={0}
                                    step={0.5}
                                    onChange={(e) =>
                                        setDrinksPerHourThisPlayer(
                                            Math.max(0, parseFloat(e.target.value) || 0)
                                        )
                                    }
                                    disabled={isPending}
                                />
                            </label>
                            <label style={styles.numberLabel}>
                                <span style={styles.numberLabelText}>Drinks / hr (everyone)</span>
                                <input
                                    type="number"
                                    style={styles.numberInput}
                                    value={avgDrinksPerHourAllPlayers}
                                    min={0}
                                    step={0.5}
                                    onChange={(e) =>
                                        setAvgDrinksPerHourAllPlayers(
                                            Math.max(0, parseFloat(e.target.value) || 0)
                                        )
                                    }
                                    disabled={isPending}
                                />
                            </label>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* ── Game tags ────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>GAME</p>
                        <p style={styles.hint}>Tag specific games or leave empty for any game.</p>

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

                    {/* ── Flags ────────────────────────────────────────────── */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>FLAGS</p>

                        <div style={styles.toggleRow}>
                            <div style={styles.toggleText}>
                                <span style={styles.toggleTitle}>Family safe</span>
                                <span style={styles.toggleSub}>
                                    Suitable for all ages — no mature content
                                </span>
                            </div>
                            <button
                                style={isFamilySafe ? styles.toggleOn : styles.toggleOff}
                                onClick={() => setIsFamilySafe((v) => !v)}
                                disabled={isPending}
                            >
                                {isFamilySafe ? "ON" : "OFF"}
                            </button>
                        </div>

                        <div style={styles.rowDivider} />

                        <div style={styles.toggleRow}>
                            <div style={styles.toggleText}>
                                <span style={styles.toggleTitle}>Game Changer</span>
                                <span style={styles.toggleSub}>
                                    Triggers a dramatic reveal with intro sequence
                                </span>
                            </div>
                            <button
                                style={isGameChanger ? styles.toggleOnViolet : styles.toggleOff}
                                onClick={() => setIsGameChanger((v) => !v)}
                                disabled={isPending}
                            >
                                {isGameChanger ? "ON" : "OFF"}
                            </button>
                        </div>
                    </div>

                    {error && <p style={styles.error}>{error}</p>}
                </div>
            </IonContent>

            {/* Bottom-anchored submit action */}
            <IonFooter>
                <div style={styles.footer}>
                    <IonButton
                        expand="block"
                        style={styles.saveButton as React.CSSProperties}
                        onClick={handleSubmit}
                        disabled={isPending}
                    >
                        Submit card
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

    // Text inputs
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
    textArea: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        padding: "var(--space-3) var(--space-4)",
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        resize: "vertical",
        lineHeight: 1.5,
    },

    // Number inputs
    numberRow: {
        display: "flex",
        gap: "var(--space-3)",
    },
    numberLabel: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        flex: 1,
    },
    numberLabelText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    numberInput: {
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
    toggleOnViolet: {
        background: "var(--color-surface)",
        border: "1.5px solid var(--color-accent-primary)",
        color: "var(--color-accent-primary)",
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
