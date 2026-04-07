import { LoginRequestSchema } from "@chance/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { IonButton, IonInput, IonSpinner } from "@ionic/react";
import React, { useTransition } from "react";
import { useForm } from "react-hook-form";
import { useHistory } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { apiClient } from "../lib/api";

// Strengthen email to trim and add user-facing message
const LoginFormSchema = LoginRequestSchema.extend({
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof LoginFormSchema>;

interface LoginFormProps {
    onSuccess: () => void;
    onCancel?: () => void;
    /** Show the "Have an invite? Create an account" nudge. Default: true */
    showNudge?: boolean;
}

export function LoginForm({ onSuccess, onCancel, showNudge = true }: LoginFormProps) {
    const { login, isGuest, accessToken, upgradeFromGuest } = useAuth();
    const history = useHistory();
    const [isPending, startTransition] = useTransition();

    const {
        register,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm<LoginFormValues>({
        resolver: zodResolver(LoginFormSchema),
        defaultValues: { email: "", password: "" },
    });

    function onSubmit(values: LoginFormValues) {
        startTransition(async () => {
            // When a guest session is active, route through the claim flow so prior
            // draws/votes are preserved and merged into the registered account.
            if (isGuest && accessToken) {
                const result = await apiClient.claimAccount(accessToken, {
                    email: values.email.trim(),
                    password: values.password,
                });
                if (result.ok) {
                    upgradeFromGuest(result.data);
                    onSuccess();
                } else {
                    if (result.error.code === "CONFLICT_ERROR") {
                        setError("root", {
                            message:
                                "That account is already in this game as another player. Each account can only appear once per session.",
                        });
                    } else {
                        setError("root", { message: result.error.message });
                    }
                }
                return;
            }
            const result = await login(values.email.trim(), values.password);
            if (result.ok) {
                onSuccess();
            } else {
                setError("root", { message: result.error.message });
            }
        });
    }

    return (
        <div style={styles.form}>
            <IonInput
                style={styles.input}
                type="email"
                placeholder="Email"
                autocomplete="email"
                inputmode="email"
                {...register("email")}
                onIonInput={(e) =>
                    register("email").onChange({
                        target: { value: String(e.detail.value ?? "") },
                    })
                }
            />
            {errors.email && <p style={styles.error}>{errors.email.message}</p>}

            <IonInput
                style={styles.input}
                type="password"
                placeholder="Password"
                autocomplete="current-password"
                {...register("password")}
                onIonInput={(e) =>
                    register("password").onChange({
                        target: { value: String(e.detail.value ?? "") },
                    })
                }
            />
            {errors.password && <p style={styles.error}>{errors.password.message}</p>}

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
                    "Sign in"
                )}
            </IonButton>

            {showNudge && (
                <p style={styles.nudge}>
                    Have an invite?{" "}
                    <button
                        style={styles.textLink}
                        onClick={() => {
                            onCancel?.();
                            history.replace("/register");
                        }}
                    >
                        Create an account
                    </button>
                </p>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
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
