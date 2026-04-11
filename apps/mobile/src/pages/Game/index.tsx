import { IonContent, IonFooter, IonPage } from "@ionic/react";
import React from "react";
import { AddPlayerModal } from "./components/AddPlayerModal";
import { CardCarousel } from "./components/CardCarousel";
import { CardDetailOverlay } from "./components/CardDetailOverlay";
import { CardRevealOverlay } from "./components/CardRevealOverlay";
import { ClaimAccountModal } from "./components/ClaimAccountModal";
import { DrawButton } from "./components/DrawButton";
import { GameHeader } from "./components/GameHeader";
import { JoinCodeModal } from "./components/JoinCodeModal";
import { PlayerActionSheet } from "./components/PlayerActionSheet";
import { DevDrawPanel } from "./components/DevDrawPanel";
import { ReparationsButton } from "./components/ReparationsButton";
import { GamePageProvider } from "./GamePageContext";
import { styles } from "./styles";
import { useGamePage } from "./useGamePage";

export default function Game() {
    const page = useGamePage();
    if (!page.session) return null;

    const {
        session,
        history,
        resolvedCards,
        showResolved,
        setShowResolved,
        error,
        showAddPlayer,
        showJoinCode,
        showClaim,
        revealCard,
        selectedCard,
    } = page;

    return (
        <GamePageProvider value={page}>
            <IonPage>
                <GameHeader />

                <IonContent scrollY className="game-content">
                    <div style={styles.contentArea as React.CSSProperties}>
                        <CardCarousel />

                        {session.status !== "active" && (
                            <div style={styles.endedBanner as React.CSSProperties}>
                                <p style={styles.endedTitle as React.CSSProperties}>
                                    This game has ended
                                </p>
                                <button
                                    style={styles.recapLink as React.CSSProperties}
                                    onClick={() => history.push(`/history/${session.id}`)}
                                >
                                    View recap →
                                </button>
                            </div>
                        )}

                        {error && <p style={styles.error as React.CSSProperties}>{error}</p>}
                    </div>
                </IonContent>

                <IonFooter>
                    <div style={styles.footer as React.CSSProperties}>
                        {resolvedCards.length > 0 && (
                            <button
                                style={styles.resolvedToggle as React.CSSProperties}
                                onClick={() => setShowResolved((v) => !v)}
                            >
                                {showResolved
                                    ? "Hide resolved"
                                    : `Show ${resolvedCards.length} resolved`}
                            </button>
                        )}
                        <DrawButton />
                        <ReparationsButton />
                        {import.meta.env.DEV && <DevDrawPanel />}
                    </div>
                </IonFooter>

                {revealCard && <CardRevealOverlay />}
                {selectedCard && !revealCard && <CardDetailOverlay />}
                {showAddPlayer && <AddPlayerModal />}
                {showJoinCode && <JoinCodeModal />}
                {showClaim && <ClaimAccountModal />}

                <PlayerActionSheet />
            </IonPage>
        </GamePageProvider>
    );
}
