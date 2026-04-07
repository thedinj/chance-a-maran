import { RegisterRequestSchema, MIN_PASSWORD_LENGTH } from "@chance/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonContent, IonInput, IonPage, IonSpinner } from "@ionic/react";
import { motion } from "motion/react";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { useHistory } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import { useAppConfig } from "../hooks/useAppConfig";
import { useGoToHomeBase } from "../hooks/useHomeBase";

// ─── Form schema ──────────────────────────────────────────────────────────────

const RegisterFormBaseSchema = RegisterRequestSchema.extend({
    displayName: z.string().trim().min(1, "Display name is required."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z
        .string()
        .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`),
    invitationCode: z.string(),
    confirmPassword: z.string(),
});

const RegisterFormSchema = RegisterFormBaseSchema.refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
});

const RegisterFormSchemaWithInvite = RegisterFormBaseSchema.extend({
    invitationCode: z.string().trim().min(1, "An invitation code is required."),
}).refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

export default function Register() {
    const history = useHistory();
    const { register } = useAuth();
    const { data: appConfig } = useAppConfig();
    const [isPending, startTransition] = useTransition();
    const goToHomeBase = useGoToHomeBase();

    const inviteRequired = appConfig.inviteCodeRequired;

    const {
        register: rhfRegister,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(inviteRequired ? RegisterFormSchemaWithInvite : RegisterFormSchema),
        defaultValues: {
            displayName: "",
            email: "",
            password: "",
            confirmPassword: "",
            invitationCode: "",
        },
    });

    function onSubmit(values: RegisterFormValues) {
        startTransition(async () => {
            const result = await register(
                values.email.trim(),
                values.password,
                values.displayName.trim(),
                inviteRequired ? values.invitationCode.trim() : ""
            );
            if (result.ok) {
                history.replace("/");
            } else if (result.error.code === "INVITATION_CODE_ERROR") {
                setError("invitationCode", { message: "That code doesn't look right." });
            } else {
                setError("root", { message: result.error.message });
            }
        });
    }

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
                            autocomplete="nickname"
                            {...rhfRegister("displayName")}
                            onIonInput={(e) =>
                                rhfRegister("displayName").onChange({
                                    target: { value: String(e.detail.value ?? "") },
                                })
                            }
                        />
                        {errors.displayName && (
                            <p style={styles.fieldError}>{errors.displayName.message}</p>
                        )}

                        <IonInput
                            style={styles.input}
                            type="email"
                            placeholder="Email"
                            autocomplete="email"
                            inputmode="email"
                            {...rhfRegister("email")}
                            onIonInput={(e) =>
                                rhfRegister("email").onChange({
                                    target: { value: String(e.detail.value ?? "") },
                                })
                            }
                        />
                        {errors.email && <p style={styles.fieldError}>{errors.email.message}</p>}

                        <IonInput
                            style={styles.input}
                            type="password"
                            placeholder="Password"
                            autocomplete="new-password"
                            {...rhfRegister("password")}
                            onIonInput={(e) =>
                                rhfRegister("password").onChange({
                                    target: { value: String(e.detail.value ?? "") },
                                })
                            }
                        />
                        {errors.password && (
                            <p style={styles.fieldError}>{errors.password.message}</p>
                        )}

                        <IonInput
                            style={styles.input}
                            type="password"
                            placeholder="Confirm password"
                            autocomplete="new-password"
                            {...rhfRegister("confirmPassword")}
                            onIonInput={(e) =>
                                rhfRegister("confirmPassword").onChange({
                                    target: { value: String(e.detail.value ?? "") },
                                })
                            }
                        />
                        {errors.confirmPassword && (
                            <p style={styles.fieldError}>{errors.confirmPassword.message}</p>
                        )}

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
                                    autocomplete="off"
                                    autocapitalize="characters"
                                    {...rhfRegister("invitationCode")}
                                    onIonInput={(e) =>
                                        rhfRegister("invitationCode").onChange({
                                            target: { value: String(e.detail.value ?? "") },
                                        })
                                    }
                                />
                                {errors.invitationCode && (
                                    <p style={styles.fieldError}>{errors.invitationCode.message}</p>
                                )}
                            </motion.div>
                        )}

                        {errors.root && <p style={styles.error}>{errors.root.message}</p>}

                        <IonButton
                            expand="block"
                            style={styles.submitButton}
                            onClick={() => void handleSubmit(onSubmit)()}
                            disabled={isPending}
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
    fieldError: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-danger)",
        margin: "calc(-1 * var(--space-1)) 0 0",
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
