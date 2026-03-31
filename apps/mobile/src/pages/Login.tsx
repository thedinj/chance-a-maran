import { IonContent, IonPage } from "@ionic/react";
import React, { useEffect } from "react";
import { useHistory } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { LoginForm } from "../components/LoginForm";
import { useAppHeader } from "../hooks/useAppHeader";

export default function Login() {
    const history = useHistory();
    const { setShowBack } = useAppHeader();

    useEffect(() => {
        setShowBack(true);
        return () => setShowBack(false);
    }, [setShowBack]);

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>Sign in</h1>
                    </div>
                    <LoginForm onSuccess={() => history.replace("/")} />
                </div>
            </IonContent>
        </IonPage>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        backgroundColor: "var(--color-bg)",
        padding: "var(--space-5)",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
    },
    header: {
        paddingTop: "var(--space-16)",
        paddingBottom: "var(--space-8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-display)",
        fontWeight: 700,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        margin: 0,
    },
};
