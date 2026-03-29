import { IonContent, IonPage } from "@ionic/react";
import { AppHeader } from "../components/AppHeader";

export default function Game() {
    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <p style={{ padding: "var(--space-5)", color: "var(--color-text-secondary)", fontFamily: "var(--font-ui)" }}>
                    Game — coming soon
                </p>
            </IonContent>
        </IonPage>
    );
}
