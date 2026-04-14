"use client";

import { Badge, Checkbox, Group, ScrollArea, Switch, Table, Text, Tooltip } from "@mantine/core";
import { useInView } from "react-intersection-observer";
import type { Card } from "@chance/core";

// ─── Lazy thumbnail ────────────────────────────────────────────────────────────

function LazyThumbnail({ imageId, apiBaseUrl }: { imageId: string; apiBaseUrl: string }) {
    const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px" });
    return (
        <div
            ref={ref}
            style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                borderRadius: 3,
                overflow: "hidden",
                background: "var(--mantine-color-dark-5)",
            }}
        >
            {inView && (
                <img
                    src={`${apiBaseUrl}/api/media/${imageId}`}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
            )}
        </div>
    );
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString();
}

// ─── Card Table ────────────────────────────────────────────────────────────────

interface CardTableProps {
    cards: Card[];
    totalCount: number;
    selectedCardId: string | null;
    selectedIds: Set<string>;
    isPending: boolean;
    apiBaseUrl: string;
    analyzedCardIds: Set<string>;
    acceptedCardIds: Set<string>;
    dismissedCardIds: Set<string>;
    noChangeCardIds: Set<string>;
    onCardClick: (card: Card) => void;
    onSelectedIdsChange: (ids: Set<string>) => void;
    onToggleGlobal: (card: Card) => void;
}

export function CardTable({
    cards,
    totalCount,
    selectedCardId,
    selectedIds,
    isPending,
    apiBaseUrl,
    analyzedCardIds,
    acceptedCardIds,
    dismissedCardIds,
    noChangeCardIds,
    onCardClick,
    onSelectedIdsChange,
    onToggleGlobal,
}: CardTableProps) {
    const rows = cards.map((card) => (
        <Table.Tr
            key={card.id}
            style={{ cursor: "pointer" }}
            bg={selectedCardId === card.id ? "var(--mantine-color-dark-6)" : undefined}
            onClick={() => onCardClick(card)}
        >
            <Table.Td onClick={(e) => e.stopPropagation()}>
                <Tooltip
                    label="Maximum 20 cards selected"
                    disabled={selectedIds.has(card.id) || selectedIds.size < 20}
                    withArrow
                >
                    <Checkbox
                        checked={selectedIds.has(card.id)}
                        disabled={!selectedIds.has(card.id) && selectedIds.size >= 20}
                        onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.currentTarget.checked) next.add(card.id);
                            else next.delete(card.id);
                            onSelectedIdsChange(next);
                        }}
                    />
                </Tooltip>
            </Table.Td>
            <Table.Td>
                {card.currentVersion.imageId ? (
                    <LazyThumbnail imageId={card.currentVersion.imageId} apiBaseUrl={apiBaseUrl} />
                ) : (
                    <div style={{ width: 28, height: 28 }} />
                )}
            </Table.Td>
            <Table.Td>
                <Text size="sm" truncate maw={280}>
                    {card.currentVersion.title}
                </Text>
            </Table.Td>
            <Table.Td>
                <Badge size="xs" color={card.cardType === "reparations" ? "red" : "blue"}>
                    {card.cardType}
                </Badge>
            </Table.Td>
            <Table.Td onClick={(e) => e.stopPropagation()}>
                <Switch
                    checked={card.isGlobal}
                    size="xs"
                    disabled={isPending}
                    onChange={() => onToggleGlobal(card)}
                />
            </Table.Td>
            <Table.Td>
                <Group gap={4} wrap="nowrap">
                    {card.currentVersion.isGameChanger && (
                        <Badge size="xs" color="yellow">
                            game changer
                        </Badge>
                    )}
                    {card.pendingGlobal && (
                        <Badge size="xs" color="orange">
                            nominated
                        </Badge>
                    )}
                    {analyzedCardIds.has(card.id) &&
                        (acceptedCardIds.has(card.id) ? (
                            <Tooltip label="AI changes applied" withArrow>
                                <Badge size="xs" color="green">
                                    AI ✓
                                </Badge>
                            </Tooltip>
                        ) : dismissedCardIds.has(card.id) ? (
                            <Tooltip label="AI changes not applied" withArrow>
                                <Badge size="xs" color="gray" variant="outline">
                                    AI ✗
                                </Badge>
                            </Tooltip>
                        ) : noChangeCardIds.has(card.id) ? (
                            <Tooltip label="AI found no changes needed" withArrow>
                                <Badge size="xs" color="teal" variant="light">
                                    AI ✓
                                </Badge>
                            </Tooltip>
                        ) : (
                            <Tooltip label="AI analysis run — decision pending" withArrow>
                                <Badge size="xs" color="yellow" variant="light">
                                    AI
                                </Badge>
                            </Tooltip>
                        ))}
                </Group>
            </Table.Td>
            <Table.Td>
                <Group gap={4} wrap="nowrap">
                    {card.currentVersion.drinkingLevel > 0 && (
                        <Text size="xs" c="dimmed">
                            🍺{card.currentVersion.drinkingLevel}
                        </Text>
                    )}
                    {card.currentVersion.spiceLevel > 0 && (
                        <Text size="xs" c="dimmed">
                            🌶️{card.currentVersion.spiceLevel}
                        </Text>
                    )}
                </Group>
            </Table.Td>
            <Table.Td>
                <Badge size="xs" color={card.active ? "green" : "gray"} variant="dot">
                    {card.active ? "active" : "inactive"}
                </Badge>
            </Table.Td>
            <Table.Td>
                {card.currentVersion.gameTags.length > 0 ? (
                    <Group gap={4} wrap="wrap" maw={160}>
                        {card.currentVersion.gameTags.map((g) => (
                            <Badge key={g.id} size="xs" variant="outline" color="teal">
                                {g.name}
                            </Badge>
                        ))}
                    </Group>
                ) : (
                    <Text size="xs" c="dimmed" fs="italic">
                        all
                    </Text>
                )}
            </Table.Td>
            <Table.Td>
                <Text size="xs" c="dimmed">
                    {card.ownerDisplayName}
                </Text>
            </Table.Td>
            <Table.Td>
                <Text size="xs" c="dimmed">
                    {formatDate(card.createdAt)}
                </Text>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th w={40} />
                        <Table.Th w={36} />
                        <Table.Th>Title</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Global</Table.Th>
                        <Table.Th>Flags</Table.Th>
                        <Table.Th>Levels</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Games</Table.Th>
                        <Table.Th>Owner</Table.Th>
                        <Table.Th>Created</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
            </Table>
            <Text size="xs" c="dimmed" mt="xs">
                {cards.length !== totalCount
                    ? `${cards.length} of ${totalCount} cards`
                    : `${totalCount} cards`}
            </Text>
        </ScrollArea>
    );
}
