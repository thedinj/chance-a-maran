import { Carousel } from "@mantine/carousel";
import React, { useEffect, useState } from "react";
import { CardFront } from "../../../components/GameCard";
import { hapticLight } from "../../../lib/haptics";
import { useGamePageContext } from "../GamePageContext";
import { styles } from "../styles";

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

export function CardCarousel() {
    const { displayCards, setSelectedCard, players, devicePlayerIds, activePlayerId } =
        useGamePageContext();
    const isLandscape = useIsLandscape();

    const viewingPlayerName = (() => {
        const p = players.find((pp) => pp.id === activePlayerId);
        if (!p) return null;
        const isLeft = devicePlayerIds.includes(p.id) && !p.active;
        const isRemote = !devicePlayerIds.includes(p.id);
        return isLeft || isRemote ? p.displayName : null;
    })();

    if (displayCards.length === 0) {
        return (
            <div style={styles.emptyState as React.CSSProperties}>
                <div style={styles.emptyLogo as React.CSSProperties}>C</div>
                <p style={styles.emptyTitle as React.CSSProperties}>No cards drawn yet.</p>
                <p style={styles.emptyHint as React.CSSProperties}>
                    {viewingPlayerName
                        ? `${viewingPlayerName} hasn't drawn yet.`
                        : "Tap Draw when it's your turn."}
                </p>
            </div>
        );
    }

    return (
        <div style={styles.carouselOuter as React.CSSProperties}>
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
                                setSelectedCard(event);
                            }}
                        >
                            <CardFront event={event} readOnly />
                        </div>
                    </Carousel.Slide>
                ))}
            </Carousel>
        </div>
    );
}
