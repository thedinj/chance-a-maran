import { IonButton, IonContent, IonInput, IonPage, IonSpinner } from "@ionic/react";
import React, { useEffect, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import { useAppHeader } from "../hooks/useAppHeader";
import { apiClient } from "../lib/api";

export default function Login() {
    const { login, isGuest, accessToken, upgradeFromGuest } = useAuth();
    const history = useHistory();
    const { setShowBack } = useAppHeader();

    useEffect(() => {
        setShowBack(true);
        return () => setShowBack(false);
    }, [setShowBack]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleSubmit() {
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setError("Email and password are required.");
            return;
        }
        setError(null);
        startTransition(async () => {
            // When a guest session is active, route through the claim flow so prior
            // draws/votes are preserved and merged into the registered account.
            if (isGuest && accessToken) {
                const result = await apiClient.claimAccount(accessToken, {
                    email: trimmedEmail,
                    password,
                });
                if (result.ok) {
                    upgradeFromGuest(result.data);
                    history.replace("/");
                } else {
                    setError(result.error.message);
                }
                return;
            }
            const result = await login(trimmedEmail, password);
            if (result.ok) {
                history.replace("/");
            } else {
                setError(result.error.message);
            }
        });
    }

    return (
        <IonPage>
            <AppHeader />
            <IonContent scrollY={false}>
                <div style={styles.root}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>Sign in</h1>
                    </div>

                    <div style={styles.form}>
                        <IonInput
                            style={styles.input}
                            type="email"
                            placeholder="Email"
                            value={email}
                            onIonInput={(e) => setEmail(String(e.detail.value ?? ""))}
                            autocomplete="email"
                            inputmode="email"
                        />
                        <IonInput
                            style={styles.input}
                            type="password"
                            placeholder="Password"
                            value={password}
                            onIonInput={(e) => setPassword(String(e.detail.value ?? ""))}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            autocomplete="current-password"
                        />

                        {error && <p style={styles.error}>{error}</p>}

                        <IonButton
                            expand="block"
                            style={styles.submitButton}
                            onClick={handleSubmit}
                            disabled={isPending || !email.trim() || !password}
                        >
                            {isPending ? (
                                <IonSpinner name="dots" style={{ width: 20, height: 20 }} />
                            ) : (
                                "Sign in"
                            )}
                        </IonButton>
                    </div>

                    <p style={styles.nudge}>
                        Have an invite?{" "}
                        <button
                            style={styles.textLink}
                            onClick={() => history.replace("/register")}
                        >
                            Create an account
                        </button>
                    </p>
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
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
    },
    header: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-display)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        margin: 0,
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    input: {
        "--background": "var(--color-surface)",
        "--color": "var(--color-text-primary)",
        "--placeholder-color": "var(--color-text-secondary)",
        "--padding-start": "var(--space-4)",
        "--padding-end": "var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        border: "1px solid var(--color-border)",
    } as React.CSSProperties,
    error: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
    },
    submitButton: {
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
        marginTop: "var(--space-2)",
    } as React.CSSProperties,
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
    },
};
