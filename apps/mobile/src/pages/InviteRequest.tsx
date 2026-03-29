import { IonContent, IonPage } from "@ionic/react";
import { useEffect } from "react";
import { AppHeader } from "../components/AppHeader";
import { useAppHeader } from "../hooks/useAppHeader";

export default function InviteRequest() {
    const { setShowBack } = useAppHeader();

    useEffect(() => {
        setShowBack(true);
        return () => setShowBack(false);
    }, [setShowBack]);

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <p
                    style={{
                        padding: "var(--space-5)",
                        color: "var(--color-text-secondary)",
                        fontFamily: "var(--font-ui)",
                    }}
                >
                    Request an invite — coming soon
                </p>
            </IonContent>
        </IonPage>
    );
}
