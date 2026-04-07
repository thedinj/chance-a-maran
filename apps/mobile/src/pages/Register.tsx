import { IonButton, IonContent, IonInput, IonPage, IonSpinner } from "@ionic/react";
import { motion } from "motion/react";
import React, { useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import { useAppConfig } from "../hooks/useAppConfig";
import { useGoToHomeBase } from "../hooks/useHomeBase";

export default function Register() {
    const history = useHistory();
    const { register } = useAuth();
    const { data: appConfig } = useAppConfig();

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const goToHomeBase = useGoToHomeBase();

    const inviteRequired = appConfig.inviteCodeRequired;

    function validate(): string | null {
        if (!displayName.trim()) return "Display name is required.";
        if (!z.string().email().safeParse(email.trim()).success)
            return "Enter a valid email address.";
        if (!password) return "Password is required.";
        if (password !== confirmPassword) return "Passwords don't match.";
        if (inviteRequired && !inviteCode.trim()) return "An invitation code is required.";
        return null;
    }

    function handleSubmit() {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError(null);
        startTransition(async () => {
            const result = await register(
                email.trim(),
                password,
                displayName.trim(),
                inviteRequired ? inviteCode.trim() : ""
            );
            if (result.ok) {
                history.replace("/");
            } else if (result.error.code === "INVITATION_CODE_ERROR") {
                setError("That code doesn't look right.");
            } else {
                setError(result.error.message);
            }
        });
    }

    const isSubmitDisabled =
        isPending ||
        !displayName.trim() ||
        !email.trim() ||
        !password ||
        !confirmPassword ||
        (inviteRequired && !inviteCode.trim());

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={goToHomeBase}>
                            «
                        </button>
                        <h1 style={styles.heading}>Register</h1>
                    </div>

                    <div style={styles.dividerRow}>
                        <div style={styles.dividerLine} />
                        <span style={styles.dividerGem}>◆</span>
                        <div style={styles.dividerLine} />
                    </div>

                    <div style={styles.form}>
                        <IonInput
                            style={styles.input}
                            placeholder="Display name"
                            value={displayName}
                            onIonInput={(e) => setDisplayName(String(e.detail.value ?? ""))}
                            autocomplete="nickname"
                        />
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
                            autocomplete="new-password"
                        />
                        <IonInput
                            style={styles.input}
                            type="password"
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onIonInput={(e) => setConfirmPassword(String(e.detail.value ?? ""))}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            autocomplete="new-password"
                        />

                        {inviteRequired && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.24,
                                    ease: [0.4, 0, 0.2, 1],
                                }}
                            >
                                <p style={styles.inviteLabel}>
                                    ◆&nbsp;&nbsp;BY INVITATION&nbsp;&nbsp;◆
                                </p>
                                <IonInput
                                    style={styles.inviteInput}
                                    placeholder="Invitation code"
                                    value={inviteCode}
                                    onIonInput={(e) => setInviteCode(String(e.detail.value ?? ""))}
                                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                    autocomplete="off"
                                    autocapitalize="characters"
                                />
                            </motion.div>
                        )}

                        {error && <p style={styles.error}>{error}</p>}

                        <IonButton
                            expand="block"
                            style={styles.submitButton}
                            onClick={handleSubmit}
                            disabled={isSubmitDisabled}
                        >
                            {isPending ? (
                                <IonSpinner name="dots" style={{ width: 20, height: 20 }} />
                            ) : (
                                "Create account"
                            )}
                        </IonButton>

                        <p style={styles.nudge}>
                            Already have an account?{" "}
                            <button
                                style={styles.textLink}
                                onClick={() => history.replace("/login")}
                            >
                                Sign in
                            </button>
                        </p>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingLeft: "var(--space-5)",
        paddingRight: "var(--space-5)",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
    },
    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "0 0 var(--space-2)",
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
    dividerRow: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        margin: "var(--space-5) 0",
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "var(--color-border)",
    },
    dividerGem: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-amber)",
        letterSpacing: "0.2em",
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
    inviteLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        color: "var(--color-accent-amber)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        margin: "0 0 var(--space-2) 0",
    },
    inviteInput: {
        "--background": "var(--color-surface)",
        "--color": "var(--color-text-primary)",
        "--placeholder-color": "var(--color-text-secondary)",
        "--padding-start": "var(--space-4)",
        "--padding-end": "var(--space-4)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        border: "1px solid var(--color-accent-amber)",
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
