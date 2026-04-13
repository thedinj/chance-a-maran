import React from "react";
import { AppDialog } from "../../../components/AppDialog";
import { useGamePageContext } from "../useGamePageContext";
import { styles } from "../styles";

export function ReparationsButton() {
    const {
        session,
        isActivePlayerOnDevice,
        reparationsPending,
        showReparationsConfirm,
        setShowReparationsConfirm,
        handleDrawReparations,
    } = useGamePageContext();

    if (session!.status !== "active") return null;

    return (
        <>
            <button
                style={{
                    ...(styles.reparationsLink as React.CSSProperties),
                    opacity: reparationsPending ? 0.5 : 1,
                }}
                onClick={() => setShowReparationsConfirm(true)}
                disabled={reparationsPending || !isActivePlayerOnDevice}
            >
                {reparationsPending ? "Drawing…" : "Draw reparations card"}
            </button>

            {showReparationsConfirm && (
                <AppDialog
                    title="Draw Reparations?"
                    message="A reparations card is drawn as a penalty. Once drawn, it's yours. Are you sure?"
                    accent="danger"
                    onDismiss={() => setShowReparationsConfirm(false)}
                    buttons={[
                        {
                            label: "Cancel",
                            variant: "ghost",
                            onClick: () => setShowReparationsConfirm(false),
                        },
                        {
                            label: "Draw",
                            variant: "danger",
                            onClick: () => {
                                setShowReparationsConfirm(false);
                                handleDrawReparations();
                            },
                        },
                    ]}
                />
            )}
        </>
    );
}
