import { IonContent, IonFooter, IonPage } from "@ionic/react";
import React, { useEffect, useMemo, useState } from "react";
import { CardCarousel } from "../../components/CardCarousel";
import { CardReveal } from "../../components/CardReveal";
import { AddPlayerModal } from "./components/AddPlayerModal";
import { CardActions } from "./components/CardActions";
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

    const {
        session,
        history,
        players,
        activePlayerId,
        devicePlayerIds,
        displayCards,
        resolvedCards,
        selectedCard,
        setSelectedCard,
        revealCard,
        onDismissReveal,
        showResolved,
        setShowResolved,
        error,
        showAddPlayer,
        showJoinCode,
        showClaim,
    } = page;

    // Compute viewing-player label for the carousel
    const viewingPlayerName = useMemo(() => {
        const p = players.find((pp) => pp.id === activePlayerId);
        if (!p) return null;
        const isLeft = devicePlayerIds.includes(p.id) && !p.active;
        const isRemote = !devicePlayerIds.includes(p.id);
        return isLeft || isRemote ? p.displayName : null;
    }, [players, activePlayerId, devicePlayerIds]);

    // Track whether the drawer has tapped "Tap to reveal" in the detail overlay
    const [detailHasRevealed, setDetailHasRevealed] = useState(false);
    useEffect(() => {
        setDetailHasRevealed(
            !selectedCard?.cardVersion.hasHiddenInstructions || !!selectedCard?.descriptionShared
        );
    }, [selectedCard?.id]);

    // Session missing — redirect is in flight (handled by the useEffect in useGamePage).
    if (!session) return null;

    const handleDismissDetail = () => setSelectedCard(null);

    return (
        <GamePageProvider value={page}>
            <IonPage>
                <GameHeader />

                <IonContent scrollY className="game-content">
                    <div style={styles.contentArea as React.CSSProperties}>
                        <CardCarousel
                            displayCards={displayCards}
                            onSelectCard={setSelectedCard}
                            viewingPlayerName={viewingPlayerName}
                        />

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

                {revealCard && (
                    <CardReveal
                        card={revealCard.card}
                        cardVersion={revealCard.cardVersion}
                        onDismiss={onDismissReveal}
                    />
                )}
                {selectedCard && !revealCard && (
                    <CardReveal
                        card={selectedCard.card}
                        cardVersion={selectedCard.cardVersion}
                        mode="quick"
                        onDismiss={handleDismissDetail}
                        onCardReveal={() => setDetailHasRevealed(true)}
                        footer={
                            <CardActions
                                event={selectedCard}
                                onDismiss={handleDismissDetail}
                                hasRevealed={detailHasRevealed}
                            />
                        }
                    />
                )}
                {showAddPlayer && <AddPlayerModal />}
                {showJoinCode && <JoinCodeModal />}
                {showClaim && <ClaimAccountModal />}

                <PlayerActionSheet />
            </IonPage>
        </GamePageProvider>
    );
}
