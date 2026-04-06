import { IonButton, IonContent, IonFooter, IonPage } from "@ionic/react";
import React, { useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/useAuth";
import { useAppHeader } from "../hooks/useAppHeader";
import { useSession } from "../session/useSession";
import { apiClient } from "../lib/api";
import type { SubmitCardRequest } from "../lib/api/types";
import CardEditor, { type CardEditorHandle } from "../components/CardEditor";

// ─── Component ───────────────────────────────────────────────────────────────

export default function SubmitCard() {
    const { user, isInitializing } = useAuth();
    const { session } = useSession();
    const history = useHistory();
    const { setShowBack } = useAppHeader();
    const editorRef = useRef<CardEditorHandle>(null);

    useEffect(() => {
        setShowBack(true);
        return () => setShowBack(false);
    }, [setShowBack]);

    // Registered-only page
    if (!user) {
        if (!isInitializing) history.replace("/");
        return null;
    }

    async function onValidSubmit(
        data: SubmitCardRequest,
        imageUrl: string | undefined
    ): Promise<string | null> {
        const req = { ...data, imageUrl };
        const result = session
            ? await apiClient.submitCard(session.id, req)
            : await apiClient.submitCardOutsideSession(req);
        if (!result.ok) return result.error.message;
        history.goBack();
        return null;
    }

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.pageHeader}>
                    <button style={styles.backLink} onClick={() => history.goBack()}>
                        «
                    </button>
                    <h1 style={styles.heading}>Submit card</h1>
                </div>
                <CardEditor ref={editorRef} onValidSubmit={onValidSubmit} />
                <div style={{ height: "var(--space-8)" }} />
            </IonContent>

            <IonFooter>
                <div style={styles.footer}>
                    <IonButton
                        expand="block"
                        style={styles.saveButton as React.CSSProperties}
                        onClick={() => editorRef.current?.submitForm()}
                    >
                        Submit card
                    </IonButton>
                    <button style={styles.cancelLink} onClick={() => history.goBack()}>
                        Cancel
                    </button>
                </div>
            </IonFooter>
        </IonPage>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-5) var(--space-5) var(--space-5)",
        backgroundColor: "var(--color-bg)",
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
    footer: {
        backgroundColor: "var(--color-bg)",
        borderTop: "1px solid var(--color-border)",
        padding: "var(--space-4) var(--space-5)",
        paddingBottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
    },
    saveButton: {
        "--background": "var(--color-surface)",
        "--border-color": "var(--color-accent-primary)",
        "--border-width": "1.5px",
        "--border-style": "solid",
        "--color": "var(--color-text-primary)",
        "--border-radius": "0",
        "--min-height": "56px",
        fontFamily: "var(--font-ui)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontSize: "var(--text-label)",
    } as React.CSSProperties,
    cancelLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "var(--space-2)",
        textAlign: "center",
        alignSelf: "center",
        minHeight: "44px",
        display: "flex",
        alignItems: "center",
    },
};
