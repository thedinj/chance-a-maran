import React from "react";
import { LoginForm } from "../../../components/LoginForm";
import { useGamePageContext } from "../GamePageContext";
import { styles } from "../styles";

export function ClaimAccountModal() {
    const { setShowClaim } = useGamePageContext();

    return (
        <div style={styles.overlayBackdrop as React.CSSProperties} onClick={() => setShowClaim(false)}>
            <div style={styles.addPlayerSheet as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
                <p style={styles.addPlayerTitle as React.CSSProperties}>Log in to link your account</p>
                <p style={styles.addPlayerHint as React.CSSProperties}>
                    Sign in to attach your player to a registered account. Your draws and votes will
                    be preserved.
                </p>
                <LoginForm onSuccess={() => setShowClaim(false)} onCancel={() => setShowClaim(false)} showNudge={false} />
            </div>
        </div>
    );
}
