import React from "react";
import { IonContent, IonPage } from "@ionic/react";

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[AppErrorBoundary]", error, info);
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        if (this.state.error) {
            return (
                <IonPage>
                    <IonContent>
                        <div style={styles.container}>
                            <span style={styles.logo}>C</span>
                            <p style={styles.message}>Something went wrong.</p>
                            <button style={styles.retry} onClick={this.handleReset}>
                                Try again
                            </button>
                        </div>
                    </IonContent>
                </IonPage>
            );
        }
        return this.props.children;
    }
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "var(--space-4)",
        padding: "var(--space-8)",
        backgroundColor: "var(--color-bg)",
    },
    logo: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-display)",
        color: "var(--color-border)",
    },
    message: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    retry: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
    },
};
