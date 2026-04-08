import React from "react";
import ReactDOM from "react-dom";

export type DialogButtonVariant = "default" | "accent" | "danger" | "ghost";

export interface DialogButton {
    label: string;
    variant?: DialogButtonVariant;
    disabled?: boolean;
    /** Shows "…" and disables all buttons while true */
    isPending?: boolean;
    onClick: () => void;
}

export interface AppDialogProps {
    title: string;
    message: string;
    /** Buttons rendered left-to-right in the footer. Divide equally. */
    buttons: DialogButton[];
    /** Color of the top accent rule. Defaults to amber. */
    accent?: "amber" | "danger" | "primary";
    /** Called when the backdrop is tapped */
    onDismiss?: () => void;
}

export function AppDialog({
    title,
    message,
    buttons,
    accent = "amber",
    onDismiss,
}: AppDialogProps) {
    const anyPending = buttons.some((b) => b.isPending);

    const accentGradient: Record<string, string> = {
        amber: "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-amber) 82%, transparent) 0%, color-mix(in srgb, var(--color-accent-amber) 20%, transparent) 100%)",
        danger: "linear-gradient(90deg, var(--color-danger) 0%, color-mix(in srgb, var(--color-danger) 30%, transparent) 100%)",
        primary:
            "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-primary) 82%, transparent) 0%, color-mix(in srgb, var(--color-accent-primary) 20%, transparent) 100%)",
    };

    const variantColor: Record<DialogButtonVariant, string> = {
        default: "var(--color-text-secondary)",
        accent: "var(--color-accent-amber)",
        danger: "var(--color-danger)",
        ghost: "var(--color-text-secondary)",
    };

    return ReactDOM.createPortal(
        <div style={styles.backdrop} onClick={onDismiss}>
            <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div style={{ ...styles.topRule, background: accentGradient[accent] }} />

                <div style={styles.body}>
                    <p style={styles.title}>{title}</p>
                    <p style={styles.message}>{message}</p>
                </div>

                <div style={styles.actions}>
                    {buttons.map((btn, i) => (
                        <button
                            key={i}
                            className="app-dialog-btn"
                            style={{
                                ...styles.actionBtn,
                                color: variantColor[btn.variant ?? "default"],
                                fontWeight:
                                    btn.variant &&
                                    btn.variant !== "ghost" &&
                                    btn.variant !== "default"
                                        ? 600
                                        : 500,
                                borderRight:
                                    i < buttons.length - 1
                                        ? "1px solid var(--color-border)"
                                        : "none",
                                opacity: anyPending || btn.disabled ? 0.5 : 1,
                            }}
                            onClick={btn.onClick}
                            disabled={anyPending || btn.disabled}
                        >
                            {btn.isPending ? "…" : btn.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    backdrop: {
        position: "fixed",
        inset: 0,
        zIndex: 200,
        backgroundColor: "color-mix(in srgb, var(--color-bg) 80%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-5)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        animation: "fadeIn 140ms var(--ease) forwards",
    },
    dialog: {
        background: "var(--color-surface-elevated)",
        clipPath:
            "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
        boxShadow:
            "inset 0 0 0 1px var(--color-border), 0 32px 64px -24px color-mix(in srgb, var(--color-bg) 70%, transparent)",
        width: "100%",
        maxWidth: "320px",
        overflow: "hidden",
        animation: "scaleIn 180ms var(--ease) forwards",
    },
    topRule: {
        height: "3px",
        width: "100%",
    },
    body: {
        padding: "var(--space-6) var(--space-5) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    title: {
        fontFamily: "var(--font-display)",
        fontSize: "clamp(22px, 6vw, 28px)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        margin: 0,
    },
    message: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
        margin: 0,
    },
    actions: {
        display: "flex",
        flexDirection: "row",
        borderTop: "1px solid var(--color-border)",
    },
    actionBtn: {
        flex: 1,
        height: "52px",
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        cursor: "pointer",
        letterSpacing: "0.04em",
        transition:
            "background 140ms var(--ease), color 140ms var(--ease), opacity 140ms var(--ease)",
    },
};
