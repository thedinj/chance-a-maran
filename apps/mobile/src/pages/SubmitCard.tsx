import { IonButton, IonContent, IonFooter, IonPage, useIonViewWillEnter } from "@ionic/react";
import React, { useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { AppHeader } from "../components/AppHeader";
import CardEditor, { type CardEditorHandle } from "../components/CardEditor";
import { CardReveal } from "../components/CardReveal";
import { useGoToHomeBase } from "../hooks/useHomeBase";
import { apiClient } from "../lib/api";
import type { Card, CardVersion, SubmitCardRequest } from "../lib/api/types";
import { useSession } from "../session/useSession";

// ─── Component ───────────────────────────────────────────────────────────────

export default function SubmitCard() {
    const { user, isInitializing } = useAuth();
    const { session } = useSession();
    const history = useHistory();
    const editorRef = useRef<CardEditorHandle>(null);
    const contentRef = useRef<HTMLIonContentElement>(null);
    const goToHomeBase = useGoToHomeBase();
    const [previewCard, setPreviewCard] = useState<{ card: Card; cardVersion: CardVersion } | null>(null);

    useIonViewWillEnter(() => {
        editorRef.current?.reset();
        contentRef.current?.scrollToTop(0);
    });

    // Registered-only page
    if (!user) {
        if (!isInitializing) history.replace("/");
        return null;
    }

    function handlePreview() {
        if (!editorRef.current || !user) return;
        const values = editorRef.current.getPreviewData();
        const previewVersion: CardVersion = {
            id: "preview",
            cardId: "preview",
            versionNumber: 1,
            title: values.title || "Untitled",
            description: values.description || "",
            hiddenInstructions: values.hiddenInstructions ?? null,
            hasHiddenInstructions: !!values.hiddenInstructions,
            imageId: values.imageId || null,
            soundId: values.soundId ?? null,
            imageYOffset: values.imageYOffset ?? 0.5,
            drinkingLevel: values.drinkingLevel ?? 0,
            spiceLevel: values.spiceLevel ?? 0,
            isGameChanger: values.cardType === "reparations" ? false : (values.isGameChanger ?? false),
            gameTags: [],
            requirements: [],
            authoredByUserId: user.id,
            authorDisplayName: user.displayName,
            createdAt: new Date().toISOString(),
        };
        const previewCardObj: Card = {
            id: "preview",
            authorUserId: user.id,
            authorDisplayName: user.displayName,
            ownerUserId: user.id,
            ownerDisplayName: user.displayName,
            cardType: values.cardType ?? "standard",
            active: true,
            isGlobal: false,
            pendingGlobal: false,
            createdInSessionId: null,
            currentVersionId: "preview",
            currentVersion: previewVersion,
            netVotes: 0,
            createdAt: new Date().toISOString(),
        };
        setPreviewCard({ card: previewCardObj, cardVersion: previewVersion });
    }

    async function onValidSubmit(
        data: SubmitCardRequest,
    ): Promise<{ savedSpiceLevel: number } | { error: string }> {
        const result = session
            ? await apiClient.submitCard(session.id, data)
            : await apiClient.submitCardOutsideSession(data);
        if (!result.ok) return { error: result.error.message };
        goToHomeBase();
        return { savedSpiceLevel: result.data.currentVersion.spiceLevel };
    }

    return (
        <IonPage>
            <AppHeader />
            <IonContent ref={contentRef}>
                <div style={styles.pageHeader}>
                    <button style={styles.backLink} onClick={goToHomeBase}>
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
                    <button style={styles.previewButton} onClick={handlePreview}>
                        Preview
                    </button>
                    <button style={styles.cancelLink} onClick={goToHomeBase}>
                        Cancel
                    </button>
                </div>
            </IonFooter>

            {previewCard && (
                <CardReveal
                    card={previewCard.card}
                    cardVersion={previewCard.cardVersion}
                    onDismiss={() => setPreviewCard(null)}
                />
            )}
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
    previewButton: {
        background: "none",
        border: "1px solid var(--color-border)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-label)",
        color: "var(--color-text-secondary)",
        cursor: "pointer",
        padding: "var(--space-3)",
        textAlign: "center",
        alignSelf: "stretch",
        minHeight: "44px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
    },
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
