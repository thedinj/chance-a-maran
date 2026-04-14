"use client";

import { Badge, Group, Paper, Text } from "@mantine/core";
import { useInView } from "react-intersection-observer";
import type { Card } from "@chance/core";
import { CARD_IMAGE_ASPECT_RATIO } from "@chance/core";

// ─── Lazy card image ───────────────────────────────────────────────────────────

const IMAGE_ASPECT = `${CARD_IMAGE_ASPECT_RATIO.width} / ${CARD_IMAGE_ASPECT_RATIO.height}`;

function LazyCardImage({
    imageId,
    imageYOffset,
    apiBaseUrl,
}: {
    imageId: string | null;
    imageYOffset: number;
    apiBaseUrl: string;
}) {
    const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px" });

    if (!imageId) {
        return (
            <div
                style={{
                    width: "100%",
                    aspectRatio: IMAGE_ASPECT,
                    background: "var(--mantine-color-dark-6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Text size="xl" c="dimmed" fw={700}>
                    C
                </Text>
            </div>
        );
    }

    return (
        <div
            ref={ref}
            style={{
                width: "100%",
                aspectRatio: IMAGE_ASPECT,
                overflow: "hidden",
                background: "var(--mantine-color-dark-5)",
                position: "relative",
            }}
        >
            {inView && (
                <img
                    src={`${apiBaseUrl}/api/media/${imageId}`}
                    alt=""
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: `center ${(imageYOffset ?? 0.5) * 100}%`,
                        display: "block",
                    }}
                />
            )}
        </div>
    );
}

// ─── Card Preview Grid ─────────────────────────────────────────────────────────

interface CardPreviewGridProps {
    cards: Card[];
    selectedCardId: string | null;
    apiBaseUrl: string;
    onCardClick: (card: Card) => void;
}

export function CardPreviewGrid({
    cards,
    selectedCardId,
    apiBaseUrl,
    onCardClick,
}: CardPreviewGridProps) {
    return (
        <>
            <style>{`
                .card-grid-tile:hover {
                    box-shadow: 0 4px 16px -4px rgba(0,0,0,0.5);
                    transform: translateY(-1px);
                }
            `}</style>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                }}
            >
                {cards.map((card) => {
                    const cv = card.currentVersion;
                    const isSelected = selectedCardId === card.id;
                    return (
                        <Paper
                            key={card.id}
                            className="card-grid-tile"
                            withBorder
                            shadow="sm"
                            style={{
                                flex: "1 1 180px",
                                maxWidth: 220,
                                cursor: "pointer",
                                outline: isSelected
                                    ? "2px solid var(--mantine-color-blue-5)"
                                    : "2px solid transparent",
                                transition: "box-shadow 120ms ease, transform 120ms ease",
                                overflow: "hidden",
                            }}
                            onClick={() => onCardClick(card)}
                        >
                            <LazyCardImage
                                imageId={cv.imageId}
                                imageYOffset={cv.imageYOffset ?? 0.5}
                                apiBaseUrl={apiBaseUrl}
                            />
                            <div
                                style={{
                                    padding: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}
                            >
                                <Text size="sm" fw={600} lineClamp={2}>
                                    {cv.title}
                                </Text>
                                <Group gap={4}>
                                    <Badge
                                        size="xs"
                                        color={card.cardType === "reparations" ? "red" : "blue"}
                                    >
                                        {card.cardType}
                                    </Badge>
                                    {!card.active && (
                                        <Badge size="xs" color="gray" variant="dot">
                                            inactive
                                        </Badge>
                                    )}
                                    {card.isGlobal && (
                                        <Badge size="xs" color="teal" variant="light">
                                            global
                                        </Badge>
                                    )}
                                </Group>
                                {(cv.drinkingLevel > 0 || cv.spiceLevel > 0) && (
                                    <Group gap={6}>
                                        {cv.drinkingLevel > 0 && (
                                            <Text size="xs" c="dimmed">
                                                🍺{cv.drinkingLevel}
                                            </Text>
                                        )}
                                        {cv.spiceLevel > 0 && (
                                            <Text size="xs" c="dimmed">
                                                🌶️{cv.spiceLevel}
                                            </Text>
                                        )}
                                    </Group>
                                )}
                            </div>
                        </Paper>
                    );
                })}
            </div>
        </>
    );
}
