import { Network } from "@capacitor/network";
import React, { useEffect, useState } from "react";

export function NetworkStatusBanner() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Get initial status
        Network.getStatus().then((status) => setIsOnline(status.connected));

        // Listen for changes
        const listener = Network.addListener("networkStatusChange", (status) => {
            setIsOnline(status.connected);
        });

        return () => {
            listener.then((handle) => handle.remove());
        };
    }, []);

    if (isOnline) return null;

    return (
        <div style={styles.banner} role="status" aria-live="polite">
            <span style={styles.text}>No connection</span>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    banner: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: "var(--color-accent-amber)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-2) var(--space-4)",
        // Respect safe area top inset on notched devices
        paddingTop: "calc(var(--space-2) + env(safe-area-inset-top))",
    },
    text: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        fontWeight: 500,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: "var(--color-bg)",
    },
};
