import React from "react";
import { useGamePageContext } from "../GamePageContext";
import { styles } from "../styles";

export function JoinCodeModal() {
    const { session, setShowJoinCode } = useGamePageContext();
    const joinCode = session!.joinCode;
    const formatted =
        joinCode.length >= 6 ? `${joinCode.slice(0, 3)}-${joinCode.slice(3)}` : joinCode;

    return (
        <div style={styles.overlayBackdrop as React.CSSProperties} onClick={() => setShowJoinCode(false)}>
            <div style={styles.joinCodeModal as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
                <button style={styles.joinCodeClose as React.CSSProperties} onClick={() => setShowJoinCode(false)} aria-label="Close">
                    ×
                </button>
                <p style={styles.joinCodeLabel as React.CSSProperties}>INVITE CODE</p>
                <p style={styles.joinCodeDisplay as React.CSSProperties}>{formatted}</p>
                <p style={styles.joinCodeSub as React.CSSProperties}>Share this code to invite players</p>
            </div>
        </div>
    );
}
