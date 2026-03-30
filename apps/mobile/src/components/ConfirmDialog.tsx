import React from "react";

interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Red/danger styling on the confirm button */
    destructive?: boolean;
    isPending?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmDialog({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    isPending = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <div style={styles.backdrop} onClick={onCancel}>
            <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
                {/* Top accent rule */}
                <div
                    style={{
                        ...styles.topRule,
                        background: destructive
                            ? "linear-gradient(90deg, var(--color-danger) 0%, color-mix(in srgb, var(--color-danger) 30%, transparent) 100%)"
                            : "linear-gradient(90deg, color-mix(in srgb, var(--color-accent-amber) 82%, transparent) 0%, color-mix(in srgb, var(--color-accent-amber) 20%, transparent) 100%)",
                    }}
                />

                <div style={styles.body}>
                    <p style={styles.title}>{title}</p>
                    <p style={styles.message}>{message}</p>
                </div>

                <div style={styles.actions}>
                    <button style={styles.cancelBtn} onClick={onCancel} disabled={isPending}>
                        {cancelLabel}
                    </button>
                    <button
                        style={{
                            ...styles.confirmBtn,
                            ...(destructive ? styles.confirmBtnDestructive : styles.confirmBtnDefault),
                            opacity: isPending ? 0.6 : 1,
                        }}
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending ? "…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
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
    cancelBtn: {
        flex: 1,
        height: "52px",
        background: "none",
        border: "none",
        borderRight: "1px solid var(--color-border)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        letterSpacing: "0.04em",
        transition: "background 140ms var(--ease)",
    },
    confirmBtn: {
        flex: 1,
        height: "52px",
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 600,
        cursor: "pointer",
        letterSpacing: "0.04em",
        transition: "background 140ms var(--ease), color 140ms var(--ease)",
    },
    confirmBtnDefault: {
        color: "var(--color-accent-amber)",
    },
    confirmBtnDestructive: {
        color: "var(--color-danger)",
    },
};
