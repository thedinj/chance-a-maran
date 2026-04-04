import { IonButton, IonContent, IonInput, IonModal, IonPage, IonSpinner } from "@ionic/react";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import { apiClient } from "../lib/api";

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppSettings() {
    const { user, logout, updateCurrentUser } = useAuth();
    const history = useHistory();

    // Profile form
    const [displayName, setDisplayName] = useState(user?.displayName ?? "");
    const [email, setEmail] = useState(user?.email ?? "");
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileSuccess, setProfileSuccess] = useState(false);
    const [isProfilePending, startProfileTransition] = useTransition();

    // Change-password modal
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [isPasswordPending, startPasswordTransition] = useTransition();

    const currentPasswordRef = useRef<HTMLIonInputElement>(null);

    // Focus current-password input when modal opens
    useEffect(() => {
        if (passwordModalOpen) {
            const t = setTimeout(() => currentPasswordRef.current?.setFocus(), 80);
            return () => clearTimeout(t);
        }
    }, [passwordModalOpen]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    function handleSaveProfile() {
        const trimmedName = displayName.trim();
        const trimmedEmail = email.trim();
        if (!trimmedName) {
            setProfileError("Display name cannot be empty.");
            return;
        }
        setProfileError(null);
        setProfileSuccess(false);

        startProfileTransition(async () => {
            const result = await apiClient.updateUser({
                displayName: trimmedName !== user?.displayName ? trimmedName : undefined,
                email: trimmedEmail !== user?.email ? trimmedEmail : undefined,
            });
            if (!result.ok) {
                setProfileError(result.error.message);
                return;
            }
            updateCurrentUser(result.data);
            setProfileSuccess(true);
        });
    }

    function handleOpenPasswordModal() {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordError(null);
        setPasswordSuccess(false);
        setPasswordModalOpen(true);
    }

    function handleClosePasswordModal() {
        setPasswordModalOpen(false);
    }

    function handleChangePassword() {
        if (!currentPassword) {
            setPasswordError("Enter your current password.");
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError("New password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("Passwords do not match.");
            return;
        }
        setPasswordError(null);

        startPasswordTransition(async () => {
            const result = await apiClient.changePassword({ currentPassword, newPassword });
            if (!result.ok) {
                setPasswordError(result.error.message);
                return;
            }
            setPasswordSuccess(true);
            setTimeout(() => setPasswordModalOpen(false), 1200);
        });
    }

    async function handleSignOut() {
        await logout();
        history.replace("/");
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const memberSince = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
          })
        : null;

    return (
        <IonPage>
            <AppHeader />
            <IonContent scrollY={true}>
                <div style={styles.root}>
                    {" "}
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={() => history.goBack()}>
                            «
                        </button>
                        <h1 style={styles.pageTitle}>Settings</h1>
                    </div>
                    {/* ── Profile ─────────────────────────────────────────────── */}
                    <section style={styles.section}>
                        <h2 style={styles.sectionHeading}>Profile</h2>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Display name</label>
                            <IonInput
                                style={styles.input}
                                value={displayName}
                                onIonInput={(e) => {
                                    setDisplayName(String(e.detail.value ?? ""));
                                    setProfileSuccess(false);
                                }}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && !isProfilePending && handleSaveProfile()
                                }
                                placeholder="Your name"
                                maxlength={30}
                                autocapitalize="words"
                                autocomplete="nickname"
                            />
                        </div>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Email</label>
                            <IonInput
                                style={styles.input}
                                value={email}
                                onIonInput={(e) => {
                                    setEmail(String(e.detail.value ?? ""));
                                    setProfileSuccess(false);
                                }}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && !isProfilePending && handleSaveProfile()
                                }
                                placeholder="you@example.com"
                                type="email"
                                inputmode="email"
                                autocomplete="email"
                            />
                        </div>

                        {profileError && <p style={styles.errorText}>{profileError}</p>}
                        {profileSuccess && <p style={styles.successText}>Profile updated.</p>}

                        <IonButton
                            expand="block"
                            style={styles.primaryButton}
                            onClick={handleSaveProfile}
                            disabled={isProfilePending}
                        >
                            {isProfilePending ? (
                                <IonSpinner name="dots" style={{ width: 20, height: 20 }} />
                            ) : (
                                "Save changes"
                            )}
                        </IonButton>
                    </section>
                    <div style={styles.divider} />
                    {/* ── Security ─────────────────────────────────────────────── */}
                    <section style={styles.section}>
                        <h2 style={styles.sectionHeading}>Security</h2>
                        <IonButton
                            fill="outline"
                            expand="block"
                            style={styles.outlineButton}
                            onClick={handleOpenPasswordModal}
                        >
                            Change password
                        </IonButton>
                    </section>
                    <div style={styles.divider} />
                    {/* ── Session ──────────────────────────────────────────────── */}
                    <section style={styles.section}>
                        <h2 style={styles.sectionHeading}>Account</h2>
                        {memberSince && (
                            <p style={styles.memberSince}>Member since {memberSince}</p>
                        )}
                        <IonButton
                            fill="clear"
                            expand="block"
                            style={styles.dangerButton}
                            onClick={handleSignOut}
                        >
                            Sign out
                        </IonButton>
                    </section>
                </div>
            </IonContent>

            {/* ── Change-password modal ──────────────────────────────────────── */}
            <IonModal
                isOpen={passwordModalOpen}
                onDidDismiss={handleClosePasswordModal}
                initialBreakpoint={0.65}
                breakpoints={[0, 0.65]}
                style={styles.modal}
            >
                <div style={styles.modalRoot}>
                    <h2 style={styles.modalHeading}>Change password</h2>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Current password</label>
                        <IonInput
                            ref={currentPasswordRef}
                            style={styles.input}
                            value={currentPassword}
                            onIonInput={(e) => {
                                setCurrentPassword(String(e.detail.value ?? ""));
                                setPasswordError(null);
                            }}
                            type="password"
                            autocomplete="current-password"
                            placeholder="••••••••"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>New password</label>
                        <IonInput
                            style={styles.input}
                            value={newPassword}
                            onIonInput={(e) => {
                                setNewPassword(String(e.detail.value ?? ""));
                                setPasswordError(null);
                            }}
                            type="password"
                            autocomplete="new-password"
                            placeholder="••••••••"
                        />
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Confirm new password</label>
                        <IonInput
                            style={styles.input}
                            value={confirmPassword}
                            onIonInput={(e) => {
                                setConfirmPassword(String(e.detail.value ?? ""));
                                setPasswordError(null);
                            }}
                            onKeyDown={(e) =>
                                e.key === "Enter" && !isPasswordPending && handleChangePassword()
                            }
                            type="password"
                            autocomplete="new-password"
                            placeholder="••••••••"
                        />
                    </div>

                    {passwordError && <p style={styles.errorText}>{passwordError}</p>}
                    {passwordSuccess && <p style={styles.successText}>Password updated.</p>}

                    <div style={styles.modalActions}>
                        <IonButton
                            fill="clear"
                            style={styles.cancelButton}
                            onClick={handleClosePasswordModal}
                            disabled={isPasswordPending}
                        >
                            Cancel
                        </IonButton>
                        <IonButton
                            style={styles.primaryButton}
                            onClick={handleChangePassword}
                            disabled={isPasswordPending}
                        >
                            {isPasswordPending ? (
                                <IonSpinner name="dots" style={{ width: 20, height: 20 }} />
                            ) : (
                                "Update"
                            )}
                        </IonButton>
                    </div>
                </div>
            </IonModal>
        </IonPage>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
        gap: "var(--space-5)",
    },
    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "0 var(--space-5) var(--space-2)",
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
    pageTitle: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
    },

    // ── Sections ───────────────────────────────────────────────────────────────

    section: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    sectionHeading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.01em",
        margin: 0,
    },
    divider: {
        height: 1,
        backgroundColor: "var(--color-border)",
    },

    // ── Form fields ────────────────────────────────────────────────────────────

    fieldGroup: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
    },
    label: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
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

    // ── Buttons ────────────────────────────────────────────────────────────────

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

    outlineButton: {
        "--border-color": "var(--color-border)",
        "--border-width": "1px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        "--background": "transparent",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,

    dangerButton: {
        "--color": "var(--color-danger)",
        "--border-radius": "0",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,

    cancelButton: {
        "--color": "var(--color-text-secondary)",
        "--border-radius": "0",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,

    // ── Feedback text ──────────────────────────────────────────────────────────

    errorText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: 0,
        lineHeight: 1.5,
    },
    successText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-accent-primary)",
        margin: 0,
        lineHeight: 1.5,
    },

    // ── Member since ───────────────────────────────────────────────────────────

    memberSince: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },

    // ── Modal ──────────────────────────────────────────────────────────────────

    modal: {
        "--border-radius": "0",
    } as React.CSSProperties,

    modalRoot: {
        padding: "var(--space-5)",
        paddingBottom: "calc(var(--space-5) + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        backgroundColor: "var(--color-bg)",
        height: "100%",
    },
    modalHeading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.01em",
        margin: 0,
        marginBottom: "var(--space-1)",
    },
    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "var(--space-2)",
        marginTop: "var(--space-2)",
    },
};
