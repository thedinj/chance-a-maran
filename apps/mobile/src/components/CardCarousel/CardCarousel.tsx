import { Carousel } from "@mantine/carousel";
import React, { useEffect, useState } from "react";
import type { DrawEvent } from "../../lib/api";
import { CardFront } from "../GameCard";
import { hapticLight } from "../../lib/haptics";

function useIsLandscape(): boolean {
    const get = () => typeof window !== "undefined" && window.innerWidth > window.innerHeight;
    const [landscape, setLandscape] = useState(get);
    useEffect(() => {
        const handler = () => setLandscape(get());
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);
    return landscape;
}

const emptyState: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--space-12) var(--space-5)",
    gap: "var(--space-3)",
};

const emptyLogo: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "64px",
    fontWeight: 700,
    color: "var(--color-border)",
    lineHeight: 1,
    letterSpacing: "-0.02em",
};

const emptyTitle: React.CSSProperties = {
    fontFamily: "var(--font-ui)",
    fontSize: "var(--text-body)",
    color: "var(--color-text-secondary)",
    margin: 0,
    textAlign: "center",
};

const emptyHint: React.CSSProperties = {
    fontFamily: "var(--font-ui)",
    fontSize: "var(--text-caption)",
    color: "var(--color-text-secondary)",
    margin: 0,
    textAlign: "center",
    opacity: 0.6,
};

const carouselOuter: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    paddingBottom: "var(--space-6)",
    userSelect: "none",
    WebkitUserSelect: "none",
};

export interface CardCarouselProps {
    /** Active (and optionally resolved) draw events to display. Callers pre-filter. */
    displayCards: DrawEvent[];
    /** Called when the user taps a card. */
    onSelectCard: (card: DrawEvent) => void;
    /**
     * When set, shows a "Viewing X's cards" label in the empty state.
     * Pass the player's displayName when the active player is remote or has left.
     */
    viewingPlayerName?: string | null;
}

export function CardCarousel({ displayCards, onSelectCard, viewingPlayerName }: CardCarouselProps) {
    const isLandscape = useIsLandscape();

    if (displayCards.length === 0) {
        return (
            <div style={emptyState}>
                <div style={emptyLogo}>C</div>
                <p style={emptyTitle}>No cards drawn yet.</p>
                <p style={emptyHint}>
                    {viewingPlayerName
                        ? `${viewingPlayerName} hasn't drawn yet.`
                        : "Tap Draw when it's your turn."}
                </p>
            </div>
        );
    }

    return (
        <div style={carouselOuter}>
            <Carousel
                key={isLandscape ? "landscape" : "portrait"}
                withControls={false}
                withIndicators={displayCards.length > 1}
                slideSize={isLandscape ? "25%" : "100%"}
                slideGap="12px"
                styles={{
                    indicators: { bottom: -20, gap: "6px" },
                }}
            >
                {displayCards.map((event) => (
                    <Carousel.Slide key={event.id}>
                        <div
                            style={{
                                maxWidth: "calc(65dvh * 412 / 581)",
                                margin: "0 auto",
                                opacity: event.resolved ? 0.55 : undefined,
                                cursor: "pointer",
                            }}
                            onClick={() => {
                                hapticLight();
                                onSelectCard(event);
                            }}
                        >
                            <CardFront
                                card={event.card}
                                cardVersion={event.cardVersion}
                                drawerId={event.playerId}
                                descriptionShared={event.descriptionShared}
                                readOnly
                            />
                        </div>
                    </Carousel.Slide>
                ))}
            </Carousel>
        </div>
    );
}
