import { IonActionSheet } from "@ionic/react";
import React from "react";
import { useGamePageContext } from "../GamePageContext";

export function PlayerActionSheet() {
    const {
        session,
        drawHistory,
        devicePlayerIds,
        pendingTransfers,
        isGuest,
        accessToken,
        actionSheetTarget,
        setActionSheetTarget,
        setShowClaim,
        handleLeaveOrRemove,
        history,
    } = useGamePageContext();

    const target = actionSheetTarget;

    return (
        <IonActionSheet
            isOpen={target !== null}
            onDidDismiss={() => setActionSheetTarget(null)}
            header={target?.displayName}
            buttons={[
                ...(target !== null && pendingTransfers.some((t) => t.toPlayerId === target.id)
                    ? [
                          {
                              text: "Notifications",
                              handler: () => {
                                  history.push("/notifications");
                                  setActionSheetTarget(null);
                              },
                          },
                      ]
                    : []),
                ...(isGuest &&
                !!accessToken &&
                target !== null &&
                devicePlayerIds.includes(target.id) &&
                target.userId === null
                    ? [
                          {
                              text: "Log in to link account",
                              handler: () => {
                                  setShowClaim(true);
                                  setActionSheetTarget(null);
                              },
                          },
                      ]
                    : []),
                ...(target !== null &&
                devicePlayerIds.includes(target.id) &&
                target.id !== session!.hostPlayerId
                    ? [
                          {
                              text: "Edit options",
                              handler: () => {
                                  history.push(`/game-options/${session!.id}/${target.id}`);
                                  setActionSheetTarget(null);
                              },
                          },
                      ]
                    : []),
                {
                    text: drawHistory.some((e) => e.playerId === target?.id)
                        ? "Leave game"
                        : "Remove from session",
                    role: "destructive",
                    handler: handleLeaveOrRemove,
                },
                { text: "Cancel", role: "cancel" },
            ]}
        />
    );
}
