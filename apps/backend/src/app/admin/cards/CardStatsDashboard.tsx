"use client";

import { useMemo } from "react";
import { Box, Grid, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import type { Card } from "@chance/core";
import { DRINKING_LEVELS, SPICE_LEVELS } from "@chance/core";

const DRINKING_COLORS = ["gray.5", "blue", "teal", "orange"] as const;
const SPICE_COLORS = ["gray.5", "yellow", "orange", "red"] as const;

function BreakdownRow({
    label,
    count,
    total,
    color,
}: {
    label: string;
    count: number;
    total: number;
    color: string;
}) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <Box>
            <Group justify="space-between" mb={3}>
                <Text size="xs" c={count === 0 ? "dimmed" : undefined}>
                    {label}
                </Text>
                <Group gap={8}>
                    <Text size="xs" fw={600} c={count === 0 ? "dimmed" : undefined}>
                        {count}
                    </Text>
                    <Text size="xs" c="dimmed" w={34} ta="right">
                        {pct}%
                    </Text>
                </Group>
            </Group>
            <Progress value={pct} color={color} size={3} radius="xl" />
        </Box>
    );
}

function StatPanel({
    title,
    note,
    children,
}: {
    title: string;
    note?: string;
    children: React.ReactNode;
}) {
    return (
        <Paper
            p="md"
            radius="md"
            style={{
                background: "var(--mantine-color-dark-7)",
                border: "1px solid var(--mantine-color-dark-5)",
                height: "100%",
            }}
        >
            <Text
                size="xs"
                fw={700}
                tt="uppercase"
                c="dimmed"
                mb="sm"
                style={{ letterSpacing: "0.06em" }}
            >
                {title}
            </Text>
            <Stack gap={8}>{children}</Stack>
            {note && (
                <Text size="xs" c="dimmed" mt="xs" fs="italic">
                    {note}
                </Text>
            )}
        </Paper>
    );
}

export function CardStatsDashboard({ cards }: { cards: Card[] }) {
    const n = cards.length;

    const gameNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const card of cards) {
            for (const g of card.currentVersion.gameTags) {
                map.set(g.id, g.name);
            }
        }
        return map;
    }, [cards]);

    const stats = useMemo(() => {
        const reparations = cards.filter((c) => c.cardType === "reparations").length;
        const active = cards.filter((c) => c.active).length;
        const drinkingCounts = [0, 1, 2, 3].map(
            (lvl) => cards.filter((c) => c.currentVersion.drinkingLevel === lvl).length
        );
        const spiceCounts = [0, 1, 2, 3].map(
            (lvl) => cards.filter((c) => c.currentVersion.spiceLevel === lvl).length
        );

        const gameCounts = new Map<string, number>();
        let noneCount = 0;
        for (const card of cards) {
            if (card.currentVersion.gameTags.length === 0) {
                noneCount++;
            } else {
                for (const g of card.currentVersion.gameTags) {
                    gameCounts.set(g.id, (gameCounts.get(g.id) ?? 0) + 1);
                }
            }
        }
        const sortedGames = [...gameCounts.entries()].sort((a, b) => b[1] - a[1]);

        return { reparations, active, drinkingCounts, spiceCounts, sortedGames, noneCount };
    }, [cards]);

    if (n === 0) return null;

    return (
        <Box mt="xl">
            <Text size="sm" fw={600} c="dimmed" mb="sm">
                Breakdown · {n} card{n !== 1 ? "s" : ""}
            </Text>
            <Grid>
                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                    <StatPanel title="Card Type">
                        <BreakdownRow
                            label="Standard"
                            count={n - stats.reparations}
                            total={n}
                            color="blue"
                        />
                        <BreakdownRow
                            label="Reparations"
                            count={stats.reparations}
                            total={n}
                            color="red"
                        />
                    </StatPanel>
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                    <StatPanel title="Status">
                        <BreakdownRow
                            label="Active"
                            count={stats.active}
                            total={n}
                            color="teal"
                        />
                        <BreakdownRow
                            label="Inactive"
                            count={n - stats.active}
                            total={n}
                            color="gray.5"
                        />
                    </StatPanel>
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                    <StatPanel title="Drinking Level">
                        {DRINKING_LEVELS.levels.map((l, i) => (
                            <BreakdownRow
                                key={l.value}
                                label={l.emoji ? `${l.emoji} ${l.label}` : l.label}
                                count={stats.drinkingCounts[i]}
                                total={n}
                                color={DRINKING_COLORS[i]}
                            />
                        ))}
                    </StatPanel>
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 6, lg: 4 }}>
                    <StatPanel title="Spice Level">
                        {SPICE_LEVELS.levels.map((l, i) => (
                            <BreakdownRow
                                key={l.value}
                                label={l.emoji ? `${l.emoji} ${l.label}` : l.label}
                                count={stats.spiceCounts[i]}
                                total={n}
                                color={SPICE_COLORS[i]}
                            />
                        ))}
                    </StatPanel>
                </Grid.Col>

                <Grid.Col span={{ base: 12, sm: 12, lg: 8 }}>
                    <StatPanel
                        title="Game Tags"
                        note={stats.sortedGames.length > 0 ? "Cards may carry multiple tags." : undefined}
                    >
                        {stats.sortedGames.map(([id, count]) => (
                            <BreakdownRow
                                key={id}
                                label={gameNameMap.get(id) ?? id}
                                count={count}
                                total={n}
                                color="teal"
                            />
                        ))}
                        <BreakdownRow
                            label="No game tag"
                            count={stats.noneCount}
                            total={n}
                            color="gray.5"
                        />
                    </StatPanel>
                </Grid.Col>
            </Grid>
        </Box>
    );
}
