import { IonContent, IonPage, useIonViewDidEnter } from "@ionic/react";
import React from "react";
import { useHistory } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../auth/useAuth";
import { hapticLight } from "../lib/haptics";
import { sessionHistoryQueryOptions, SESSION_HISTORY_KEY } from "../hooks/useSessionQueries";

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function GameHistoryList() {
    const { user } = useAuth();
    const history = useHistory();
    const queryClient = useQueryClient();
    const { data: sessions = [], isLoading: loading } = useQuery({
        ...sessionHistoryQueryOptions,
        enabled: !!user,
    });

    useIonViewDidEnter(() => {
        if (user) void queryClient.invalidateQueries({ queryKey: SESSION_HISTORY_KEY });
    });

    if (!user) {
        return (
            <IonPage>
                <AppHeader />
                <IonContent>
                    <div style={styles.empty}>
                        <p style={styles.emptyText}>Sign in to view your game history.</p>
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={() => history.goBack()}>
                            «
                        </button>
                        <h1 style={styles.heading}>Game History</h1>
                    </div>
                    {loading ? (
                        <p style={styles.emptyText}>Loading…</p>
                    ) : sessions.length === 0 ? (
                        <p style={styles.emptyText}>No past games yet.</p>
                    ) : (
                        sessions.map((s) => (
                            <button
                                key={s.id}
                                style={styles.row}
                                onClick={() => {
                                    void hapticLight();
                                    history.push(`/history/${s.id}`);
                                }}
                            >
                                <div style={styles.rowMain}>
                                    <span style={styles.rowName}>{s.name}</span>
                                    <span style={styles.rowMeta}>
                                        {s.playerCount} players · {s.drawCount} cards
                                        {s.status === "expired" && " · expired"}
                                    </span>
                                </div>
                                <span style={styles.rowDate}>{formatDate(s.createdAt)}</span>
                            </button>
                        ))
                    )}
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
    empty: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "var(--space-5)",
    },
    emptyText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    row: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--color-border)",
        padding: "var(--space-4) 0",
        cursor: "pointer",
        textAlign: "left" as const,
        width: "100%",
    },
    rowMain: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: 0,
    },
    rowName: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        color: "var(--color-text-primary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
    },
    rowMeta: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    rowDate: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        flexShrink: 0,
    },
};
