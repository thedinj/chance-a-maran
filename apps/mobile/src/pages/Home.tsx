import {
    IonButton,
    IonContent,
    IonInput,
    IonPage,
    IonSpinner,
} from "@ionic/react";
import React, { useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiClient } from "../lib/api";
import { useSession } from "../session/SessionContext";

export default function Home() {
    const { user, isGuest, isInitializing } = useAuth();
    const { setSession } = useSession();
    const history = useHistory();

    const [joinCode, setJoinCode] = useState("");
    const [joinError, setJoinError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const hasAccount = Boolean(user);

    function handleCreateSession() {
        history.push("/game-settings");
    }

    function handleJoin() {
        const code = joinCode.trim();
        if (!code) return;

        setJoinError(null);
        // Navigation is synchronous — display name is collected on the join screen
        startTransition(() => {
            history.push(`/join/${code}`);
        });
    }

    if (isInitializing) {
        return (
            <IonPage>
                <IonContent>
                    <div style={styles.center}>
                        <IonSpinner color="primary" />
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    return (
        <IonPage>
            <IonContent fullscreen scrollY={false}>
                <div style={styles.root}>
                    {/* Account indicator — top right, unobtrusive */}
                    <div style={styles.accountBar}>
                        {hasAccount ? (
                            <span style={styles.accountName}>{user!.displayName}</span>
                        ) : !isGuest ? (
                            <div style={styles.authLinks}>
                                <button style={styles.textLink} onClick={() => history.push("/login")}>
                                    Sign in
                                </button>
                                <span style={styles.dot}>◆</span>
                                <button style={styles.textLink} onClick={() => history.push("/register")}>
                                    Register
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* Logo / wordmark */}
                    <div style={styles.logoArea}>
                        <h1 style={styles.wordmark}>Chance</h1>
                    </div>

                    {/* Primary actions */}
                    <div style={styles.actions}>
                        {hasAccount && (
                            <IonButton
                                expand="block"
                                style={styles.primaryButton}
                                onClick={handleCreateSession}
                                disabled={isPending}
                            >
                                Create game
                            </IonButton>
                        )}

                        {/* Join via code */}
                        <div style={styles.joinRow}>
                            <IonInput
                                style={styles.codeInput}
                                placeholder="Enter code"
                                value={joinCode}
                                onIonInput={(e) => setJoinCode(String(e.detail.value ?? ""))}
                                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                                maxlength={8}
                                autocapitalize="characters"
                                autocomplete="off"
                            />
                            <IonButton
                                style={styles.joinButton}
                                onClick={handleJoin}
                                disabled={!joinCode.trim() || isPending}
                            >
                                Join
                            </IonButton>
                        </div>

                        {joinError && <p style={styles.error}>{joinError}</p>}
                    </div>

                    {/* Register nudge for users who aren't logged in */}
                    {!hasAccount && !isGuest && (
                        <p style={styles.nudge}>
                            Have an invite?{" "}
                            <button style={styles.textLink} onClick={() => history.push("/register")}>
                                Create an account
                            </button>{" "}
                            to host games.
                        </p>
                    )}
                </div>
            </IonContent>
        </IonPage>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--color-bg)",
        padding: "var(--space-5)",
        paddingTop: "calc(var(--space-5) + env(safe-area-inset-top))",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
    },
    center: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        backgroundColor: "var(--color-bg)",
    },
    accountBar: {
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        minHeight: "var(--space-8)",
    },
    accountName: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    authLinks: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
    },
    dot: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-border)",
    },
    logoArea: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    wordmark: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-display)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        margin: 0,
    },
    actions: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    primaryButton: {
        "--background": "var(--color-surface)",
        "--border-color": "var(--color-accent-primary)",
        "--border-width": "1.5px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    joinRow: {
        display: "flex",
        gap: "var(--space-2)",
    },
    codeInput: {
        flex: 1,
        "--background": "var(--color-surface)",
        "--color": "var(--color-text-primary)",
        "--placeholder-color": "var(--color-text-secondary)",
        "--border-color": "var(--color-border)",
        "--padding-start": "var(--space-4)",
        "--padding-end": "var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        border: "1px solid var(--color-border)",
    } as React.CSSProperties,
    joinButton: {
        "--background": "var(--color-surface)",
        "--border-color": "var(--color-border)",
        "--border-width": "1px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
    },
    nudge: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        textAlign: "center",
        marginTop: "var(--space-4)",
    },
    textLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
        textDecoration: "none",
    },
};
