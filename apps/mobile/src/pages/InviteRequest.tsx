import { IonContent, IonPage } from "@ionic/react";
import React from "react";
import { useHistory } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";

export default function InviteRequest() {
    const history = useHistory();

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={() => history.goBack()}>
                            «
                        </button>
                        <h1 style={styles.heading}>Request an invite</h1>
                    </div>
                    <p style={styles.body}>Coming soon</p>
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
        paddingBottom: "var(--space-8)",
    },
    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "0 var(--space-5) var(--space-5)",
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
    body: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        padding: "0 var(--space-5)",
        margin: 0,
    },
};
