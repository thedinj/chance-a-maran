"use client";

import { useEffect, useState } from "react";
import {
    Title,
    Table,
    Badge,
    Stack,
    Text,
    Loader,
    Center,
    Drawer,
    ScrollArea,
    Divider,
    Group,
} from "@mantine/core";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";
import type { FilterSettings, Player, Session } from "@chance/core";
import { DRINKING_LEVELS, SPICE_LEVELS } from "@chance/core";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AdminSession = Session & {
    hostDisplayName: string | null;
    playerCount: number;
    drawCount: number;
    players: Player[];
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
}

const STATUS_COLORS: Record<string, string> = {
    active: "green",
    ended: "gray",
    expired: "orange",
};

function FilterDetail({ fs }: { fs: FilterSettings }) {
    return (
        <Stack gap={4}>
            <Text size="xs" c="dimmed">
                Drinking max:{" "}
                {(() => {
                    const l = DRINKING_LEVELS.levels[fs.maxDrinkingLevel];
                    return l.emoji ? `${l.emoji} ${l.label}` : l.label;
                })()}
            </Text>
            <Text size="xs" c="dimmed">
                Spice max:{" "}
                {(() => {
                    const l = SPICE_LEVELS.levels[fs.maxSpiceLevel];
                    return l.emoji ? `${l.emoji} ${l.label}` : l.label;
                })()}
            </Text>
            <Text size="xs" c="dimmed">
                Global cards: {fs.includeGlobalCards ? "included" : "excluded"}
            </Text>
            {fs.gameTags.length > 0 ? (
                <Group gap={4} wrap="wrap">
                    <Text size="xs" c="dimmed">
                        Games:
                    </Text>
                    {fs.gameTags.map((t) => (
                        <Badge key={t} size="xs" variant="outline" color="teal">
                            {t}
                        </Badge>
                    ))}
                </Group>
            ) : (
                <Text size="xs" c="dimmed">
                    Games: none (universal cards only)
                </Text>
            )}
        </Stack>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
    const adminFetch = useAdminFetch();
    const [sessions, setSessions] = useState<AdminSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<AdminSession | null>(null);

    useEffect(() => {
        adminFetch("/api/admin/sessions")
            .then((r) => r.json())
            .then((d) => {
                if (d.ok)
                    setSessions(
                        (d.data as AdminSession[]).sort((a, b) =>
                            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                        )
                    );
                setLoading(false);
            });
    }, [adminFetch]);

    return (
        <>
            <Stack gap="md">
                <Title order={3}>Game Sessions</Title>

                {loading ? (
                    <Center py="xl">
                        <Loader />
                    </Center>
                ) : (
                    <ScrollArea>
                        <Table striped highlightOnHover withTableBorder>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Name</Table.Th>
                                    <Table.Th>Join Code</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Host</Table.Th>
                                    <Table.Th>Players</Table.Th>
                                    <Table.Th>Draws</Table.Th>
                                    <Table.Th>Created</Table.Th>
                                    <Table.Th>Ended</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {sessions.map((s) => (
                                    <Table.Tr
                                        key={s.id}
                                        style={{ cursor: "pointer" }}
                                        bg={
                                            selected?.id === s.id
                                                ? "var(--mantine-color-dark-6)"
                                                : undefined
                                        }
                                        onClick={() => setSelected(s)}
                                    >
                                        <Table.Td>
                                            <Text size="sm">{s.name}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" ff="monospace" fw={600}>
                                                {s.joinCode}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge
                                                size="xs"
                                                color={STATUS_COLORS[s.status] ?? "gray"}
                                            >
                                                {s.status}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs" c="dimmed">
                                                {s.hostDisplayName ?? "—"}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs">{s.playerCount}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs">{s.drawCount}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs" c="dimmed">
                                                {new Date(s.createdAt).toLocaleDateString()}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs" c="dimmed">
                                                {s.endedAt
                                                    ? new Date(s.endedAt).toLocaleDateString()
                                                    : "—"}
                                            </Text>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                        <Text size="xs" c="dimmed" mt="xs">
                            {sessions.length} sessions
                        </Text>
                    </ScrollArea>
                )}
            </Stack>

            <Drawer
                opened={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.name ?? "Session"}
                position="right"
                size="md"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {selected && (
                    <Stack gap="md">
                        {/* Header */}
                        <Group gap="xs">
                            <Badge color={STATUS_COLORS[selected.status] ?? "gray"} size="sm">
                                {selected.status}
                            </Badge>
                            <Text ff="monospace" fw={700} size="xl">
                                {selected.joinCode}
                            </Text>
                        </Group>

                        <Stack gap={2}>
                            <Text size="xs" c="dimmed">
                                Host: {selected.hostDisplayName ?? "—"}
                            </Text>
                            <Text size="xs" c="dimmed">
                                Created: {formatDate(selected.createdAt)}
                            </Text>
                            {selected.endedAt && (
                                <Text size="xs" c="dimmed">
                                    Ended: {formatDate(selected.endedAt)}
                                </Text>
                            )}
                        </Stack>

                        {/* Activity */}
                        <Group gap="xl">
                            <Stack gap={0} align="center">
                                <Text fw={700} size="xl">
                                    {selected.playerCount}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    players
                                </Text>
                            </Stack>
                            <Stack gap={0} align="center">
                                <Text fw={700} size="xl">
                                    {selected.drawCount}
                                </Text>
                                <Text size="xs" c="dimmed">
                                    draws
                                </Text>
                            </Stack>
                        </Group>

                        <Divider label="Filters" labelPosition="left" />
                        <FilterDetail fs={selected.filterSettings} />

                        <Divider
                            label={`Players (${selected.players.length})`}
                            labelPosition="left"
                        />
                        {selected.players.length === 0 ? (
                            <Text size="xs" c="dimmed" fs="italic">
                                No players
                            </Text>
                        ) : (
                            <Table withTableBorder withColumnBorders={false}>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Name</Table.Th>
                                        <Table.Th>Type</Table.Th>
                                        <Table.Th>Sharing</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {selected.players.map((p) => (
                                        <Table.Tr key={p.id}>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Text size="xs">{p.displayName}</Text>
                                                    {p.id === selected.hostPlayerId && (
                                                        <Badge
                                                            size="xs"
                                                            color="yellow"
                                                            variant="light"
                                                        >
                                                            host
                                                        </Badge>
                                                    )}
                                                    {!p.active && (
                                                        <Badge size="xs" color="gray" variant="dot">
                                                            inactive
                                                        </Badge>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge
                                                    size="xs"
                                                    color={p.userId ? "blue" : "gray"}
                                                    variant="outline"
                                                >
                                                    {p.userId ? "registered" : "guest"}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" c="dimmed">
                                                    {p.cardSharing ?? "—"}
                                                </Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Stack>
                )}
            </Drawer>
        </>
    );
}
