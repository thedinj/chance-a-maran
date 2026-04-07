import { IonContent, IonPage } from "@ionic/react";
import React from "react";
import { useHistory } from "react-router";
import { AppHeader } from "../components/AppHeader";
import { LoginForm } from "../components/LoginForm";
import { useGoToHomeBase } from "../hooks/useHomeBase";

export default function Login() {
    const history = useHistory();
    const goToHomeBase = useGoToHomeBase();

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={goToHomeBase}>
                            «
                        </button>
                        <h1 style={styles.heading}>Sign in</h1>
                    </div>
                    <LoginForm onSuccess={() => history.replace("/")} />
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
        padding: "0 0 var(--space-5)",
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
};
