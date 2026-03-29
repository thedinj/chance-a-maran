import {
    IonBackButton,
    IonButtons,
    IonHeader,
    IonMenuButton,
    IonTitle,
    IonToolbar,
} from "@ionic/react";
import React from "react";
import { useAppHeader } from "../hooks/useAppHeader";

export function AppHeader() {
    const { title, showBack } = useAppHeader();

    return (
        <IonHeader>
            <IonToolbar>
                <IonButtons slot="start">
                    {showBack ? (
                        <IonBackButton
                            defaultHref="/"
                            text=""
                            style={
                                { "--color": "var(--color-text-secondary)" } as React.CSSProperties
                            }
                        />
                    ) : (
                        <IonMenuButton
                            style={
                                { "--color": "var(--color-text-secondary)" } as React.CSSProperties
                            }
                        />
                    )}
                </IonButtons>
                {title ? (
                    <IonTitle
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "var(--text-heading)",
                            fontWeight: 600,
                            letterSpacing: "-0.02em",
                            color: "var(--color-text-primary)",
                        }}
                    >
                        {title}
                    </IonTitle>
                ) : null}
            </IonToolbar>
        </IonHeader>
    );
}
