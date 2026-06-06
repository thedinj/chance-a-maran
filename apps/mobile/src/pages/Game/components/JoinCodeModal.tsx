import React, { useState } from "react";
import { useGamePageContext } from "../useGamePageContext";
import { styles } from "../styles";

function AndroidShareIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ width: "14px", height: "14px", flexShrink: 0 }}
            aria-hidden
        >
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z" />
        </svg>
    );
}

export function JoinCodeModal() {
    const { session, setShowJoinCode } = useGamePageContext();
    const joinCode = session!.joinCode;
    const formatted =
        joinCode.length >= 6 ? `${joinCode.slice(0, 3)}-${joinCode.slice(3)}` : joinCode;

    const [status, setStatus] = useState<"idle" | "done">("idle");

    async function handleShare() {
        const site = window.location.origin;
        const text = `Join my Chance game!\nCode: ${joinCode}\n${site}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: "Chance", text });
            } catch {
                // User cancelled — no feedback needed
            }
        } else {
            await navigator.clipboard.writeText(text);
            setStatus("done");
            setTimeout(() => setStatus("idle"), 2000);
        }
    }

    return (
        <div style={styles.overlayBackdrop as React.CSSProperties} onClick={() => setShowJoinCode(false)}>
            <div style={styles.joinCodeModal as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
                <button style={styles.joinCodeClose as React.CSSProperties} onClick={() => setShowJoinCode(false)} aria-label="Close">
                    ×
                </button>
                <p style={styles.joinCodeLabel as React.CSSProperties}>INVITE CODE</p>
                <p style={styles.joinCodeDisplay as React.CSSProperties}>{formatted}</p>
                <button
                    style={(status === "done" ? styles.joinCodeShareBtnDone : styles.joinCodeShareBtn) as React.CSSProperties}
                    onClick={handleShare}
                >
                    {status === "done" ? "Copied ✓" : <><AndroidShareIcon /> Share this code to invite players</>}
                </button>
            </div>
        </div>
    );
}
