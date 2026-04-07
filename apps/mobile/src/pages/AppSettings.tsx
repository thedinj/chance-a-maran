import {
    ChangePasswordRequestSchema,
    MAX_DISPLAY_NAME_LENGTH,
    MIN_PASSWORD_LENGTH,
    UpdateUserRequestSchema,
} from "@chance/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonContent, IonInput, IonModal, IonPage, IonSpinner } from "@ionic/react";
import React, { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useHistory } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import { useGoToHomeBase } from "../hooks/useHomeBase";
import { apiClient } from "../lib/api";

// ─── Form schemas ──────────────────────────────────────────────────────────────

const ProfileFormSchema = UpdateUserRequestSchema.extend({
    displayName: z
        .string()
        .trim()
        .min(1, "Display name cannot be empty.")
        .max(MAX_DISPLAY_NAME_LENGTH),
    email: z.string().trim().email("Enter a valid email address.").optional(),
});

type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

const PasswordFormSchema = ChangePasswordRequestSchema.extend({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
        .string()
        .min(
            MIN_PASSWORD_LENGTH,
            `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        ),
    confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof PasswordFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppSettings() {
    const { user, logout, updateCurrentUser } = useAuth();
    const history = useHistory();

    // Change-password modal open state
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);

    const [isProfilePending, startProfileTransition] = useTransition();
    const [isPasswordPending, startPasswordTransition] = useTransition();

    const currentPasswordRef = useRef<HTMLIonInputElement>(null);

    // Profile form
    const {
        register: profileRegister,
        handleSubmit: handleProfileSubmit,
        setError: setProfileError,
        formState: { errors: profileErrors },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(ProfileFormSchema),
        defaultValues: {
            displayName: user?.displayName ?? "",
            email: user?.email ?? "",
        },
    });

    const [profileSuccess, setProfileSuccess] = useState(false);

    // Password form
    const {
        register: passwordRegister,
        handleSubmit: handlePasswordSubmit,
        setError: setPasswordError,
        reset: resetPasswordForm,
        formState: { errors: passwordErrors },
    } = useForm<PasswordFormValues>({
        resolver: zodResolver(PasswordFormSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    // Focus current-password input when modal opens
    useEffect(() => {
        if (passwordModalOpen) {
            const t = setTimeout(() => currentPasswordRef.current?.setFocus(), 80);
            return () => clearTimeout(t);
        }
    }, [passwordModalOpen]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    function onSaveProfile(values: ProfileFormValues) {
        setProfileSuccess(false);
        startProfileTransition(async () => {
            const result = await apiClient.updateUser({
                displayName:
                    values.displayName?.trim() !== user?.displayName
                        ? values.displayName?.trim()
                        : undefined,
                email: values.email?.trim() !== user?.email ? values.email?.trim() : undefined,
            });
            if (!result.ok) {
                setProfileError("root", { message: result.error.message });
                return;
            }
            updateCurrentUser(result.data);
            setProfileSuccess(true);
        });
    }

    function handleOpenPasswordModal() {
        resetPasswordForm();
        setPasswordSuccess(false);
        setPasswordModalOpen(true);
    }

    function handleClosePasswordModal() {
        setPasswordModalOpen(false);
    }

    function onChangePassword(values: PasswordFormValues) {
        startPasswordTransition(async () => {
            const result = await apiClient.changePassword({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            });
            if (!result.ok) {
                setPasswordError("root", { message: result.error.message });
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

    const goToHomeBase = useGoToHomeBase();

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
                        <button style={styles.backLink} onClick={goToHomeBase}>
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
                                placeholder="Your name"
                                maxlength={MAX_DISPLAY_NAME_LENGTH}
                                autocapitalize="words"
                                autocomplete="nickname"
                                {...profileRegister("displayName")}
                                onIonInput={(e) =>
                                    profileRegister("displayName").onChange({
                                        target: { value: String(e.detail.value ?? "") },
                                    })
                                }
                            />
                            {profileErrors.displayName && (
                                <p style={styles.errorText}>{profileErrors.displayName.message}</p>
                            )}
                        </div>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Email</label>
                            <IonInput
                                style={styles.input}
                                placeholder="you@example.com"
                                type="email"
                                inputmode="email"
                                autocomplete="email"
                                {...profileRegister("email")}
                                onIonInput={(e) =>
                                    profileRegister("email").onChange({
                                        target: { value: String(e.detail.value ?? "") },
                                    })
                                }
                            />
                            {profileErrors.email && (
                                <p style={styles.errorText}>{profileErrors.email.message}</p>
                            )}
                        </div>

                        {profileErrors.root && (
                            <p style={styles.errorText}>{profileErrors.root.message}</p>
                        )}
                        {profileSuccess && <p style={styles.successText}>Profile updated.</p>}

                        <IonButton
                            expand="block"
                            style={styles.primaryButton}
                            onClick={() => void handleProfileSubmit(onSaveProfile)()}
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
                            type="password"
                            autocomplete="current-password"
                            placeholder="••••••••"
                            onIonInput={(e) =>
                                passwordRegister("currentPassword").onChange({
                                    target: { value: String(e.detail.value ?? "") },
                                })
                            }
                        />
                        {passwordErrors.currentPassword && (
                            <p style={styles.errorText}>{passwordErrors.currentPassword.message}</p>
                        )}
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>New password</label>
                        <IonInput
                            style={styles.input}
                            type="password"
                            autocomplete="new-password"
                            placeholder="••••••••"
                            {...passwordRegister("newPassword")}
                            onIonInput={(e) =>
                                passwordRegister("newPassword").onChange({
                                    target: { value: String(e.detail.value ?? "") },
                                })
                            }
                        />
                        {passwordErrors.newPassword && (
                            <p style={styles.errorText}>{passwordErrors.newPassword.message}</p>
                        )}
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Confirm new password</label>
                        <IonInput
                            style={styles.input}
                            type="password"
                            autocomplete="new-password"
                            placeholder="••••••••"
                            {...passwordRegister("confirmPassword")}
                            onIonInput={(e) =>
                                passwordRegister("confirmPassword").onChange({
                                    target: { value: String(e.detail.value ?? "") },
                                })
                            }
                        />
                        {passwordErrors.confirmPassword && (
                            <p style={styles.errorText}>{passwordErrors.confirmPassword.message}</p>
                        )}
                    </div>

                    {passwordErrors.root && (
                        <p style={styles.errorText}>{passwordErrors.root.message}</p>
                    )}
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
                            onClick={() => void handlePasswordSubmit(onChangePassword)()}
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
        padding: "var(--space-5) var(--space-5) calc(var(--space-8) + env(safe-area-inset-bottom))",
        gap: "var(--space-5)",
    },
    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        paddingBottom: "var(--space-2)",
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
