"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Badge, Switch, TextInput, Group, Stack, Text,
    Drawer, Image, Button, Divider, Select, ScrollArea, Loader, Center,
    ActionIcon, Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";
import type { Card, CardVersion } from "@chance/core";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FilterState = { search: string; active: string; isGlobal: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString();
}

function LevelBadge({ label, value }: { label: string; value: number }) {
    if (value === 0) return null;
    const colors = ["gray", "yellow", "orange", "red"] as const;
    return <Badge size="xs" color={colors[value]}>{label} {value}</Badge>;
}

// ─── Card Detail Drawer ────────────────────────────────────────────────────────

function CardDrawer({
    card,
    onClose,
    onChanged,
    apiBaseUrl,
}: {
    card: Card;
    onClose: () => void;
    onChanged: (updated: Card) => void;
    apiBaseUrl: string;
}) {
    const adminFetch = useAdminFetch();
    const [isPending, startTransition] = useTransition();
    const [versions, setVersions] = useState<CardVersion[]>([]);
    const cv = card.currentVersion;

    useEffect(() => {
        adminFetch(`/api/cards/${card.id}/versions`)
            .then((r) => r.json())
            .then((d) => { if (d.ok) setVersions(d.data as CardVersion[]); });
    }, [card.id, adminFetch]);

    function action(url: string, method = "POST") {
        startTransition(async () => {
            const res = await adminFetch(url, { method });
            const data = await res.json();
            if (data.ok) {
                onChanged(data.data as Card);
                notifications.show({ message: "Updated", color: "green" });
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    return (
        <Stack gap="md">
            {cv.imageId && (
                <Image
                    src={`${apiBaseUrl}/api/images/${cv.imageId}`}
                    alt={cv.title}
                    fit="contain"
                    mah={200}
                />
            )}

            <Stack gap={4}>
                <Text fw={700} size="lg">{cv.title}</Text>
                <Group gap="xs">
                    <Badge color={card.cardType === "reparations" ? "red" : "blue"} size="sm">
                        {card.cardType}
                    </Badge>
                    {card.isGlobal && <Badge size="sm" color="violet">global</Badge>}
                    {!card.active && <Badge size="sm" color="gray">inactive</Badge>}
                    {cv.isGameChanger && <Badge size="sm" color="yellow">game changer</Badge>}
                    <LevelBadge label="🍺" value={cv.drinkingLevel} />
                    <LevelBadge label="🌶" value={cv.spiceLevel} />
                </Group>
            </Stack>

            <Text size="sm">{cv.description}</Text>

            {cv.hiddenInstructions && (
                <Stack gap={2}>
                    <Text size="xs" c="dimmed" fw={500}>HIDDEN INSTRUCTIONS</Text>
                    <Text size="sm" fs="italic">{cv.hiddenInstructions}</Text>
                </Stack>
            )}

            {cv.gameTags.length > 0 && (
                <Group gap="xs">
                    <Text size="xs" c="dimmed">Games:</Text>
                    {cv.gameTags.map((g) => <Badge key={g.id} size="xs" variant="outline">{g.name}</Badge>)}
                </Group>
            )}

            {cv.requirements.length > 0 && (
                <Group gap="xs">
                    <Text size="xs" c="dimmed">Requires:</Text>
                    {cv.requirements.map((r) => <Badge key={r.id} size="xs" variant="dot">{r.title}</Badge>)}
                </Group>
            )}

            <Text size="xs" c="dimmed">Author: {cv.authorDisplayName} · {formatDate(card.createdAt)}</Text>

            <Divider />

            <Group>
                <Button
                    size="xs"
                    variant="outline"
                    color={card.isGlobal ? "gray" : "violet"}
                    loading={isPending}
                    onClick={() =>
                        action(
                            card.isGlobal
                                ? `/api/cards/${card.id}/demote`
                                : `/api/cards/${card.id}/promote`
                        )
                    }
                >
                    {card.isGlobal ? "Remove from global" : "Promote to global"}
                </Button>
                <Button
                    size="xs"
                    variant="outline"
                    color={card.active ? "red" : "green"}
                    loading={isPending}
                    onClick={() =>
                        action(
                            card.active
                                ? `/api/cards/${card.id}/deactivate`
                                : `/api/cards/${card.id}/reactivate`
                        )
                    }
                >
                    {card.active ? "Deactivate" : "Reactivate"}
                </Button>
            </Group>

            {versions.length > 1 && (
                <>
                    <Divider label="Version history" labelPosition="left" />
                    <Stack gap={4}>
                        {versions.map((v) => (
                            <Group key={v.id} gap="xs">
                                <Text size="xs" c="dimmed" w={20}>v{v.versionNumber}</Text>
                                <Text size="xs" style={{ flex: 1 }} truncate>{v.title}</Text>
                                <Text size="xs" c="dimmed">{formatDate(v.createdAt)}</Text>
                            </Group>
                        ))}
                    </Stack>
                </>
            )}
        </Stack>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CardsPage() {
    const adminFetch = useAdminFetch();
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<FilterState>({ search: "", active: "", isGlobal: "" });
    const [selected, setSelected] = useState<Card | null>(null);
    const [isPending, startTransition] = useTransition();

    const apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "";

    function loadCards() {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.search) params.set("search", filters.search);
        if (filters.active) params.set("active", filters.active);
        if (filters.isGlobal) params.set("isGlobal", filters.isGlobal);

        adminFetch(`/api/cards?${params}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.ok) setCards(d.data as Card[]);
                setLoading(false);
            });
    }

    useEffect(() => {
        loadCards();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    function toggleGlobal(card: Card) {
        startTransition(async () => {
            const url = card.isGlobal
                ? `/api/cards/${card.id}/demote`
                : `/api/cards/${card.id}/promote`;
            const res = await adminFetch(url, { method: "POST" });
            const data = await res.json();
            if (data.ok) {
                setCards((prev) => prev.map((c) => (c.id === card.id ? (data.data as Card) : c)));
                if (selected?.id === card.id) setSelected(data.data as Card);
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    function handleCardChanged(updated: Card) {
        setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSelected(updated);
    }

    const rows = cards.map((card) => (
        <Table.Tr
            key={card.id}
            style={{ cursor: "pointer" }}
            bg={selected?.id === card.id ? "var(--mantine-color-dark-6)" : undefined}
            onClick={() => setSelected(card)}
        >
            <Table.Td>
                <Text size="sm" truncate maw={280}>{card.currentVersion.title}</Text>
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
                    onChange={() => toggleGlobal(card)}
                />
            </Table.Td>
            <Table.Td>
                <Badge size="xs" color={card.active ? "green" : "gray"} variant="dot">
                    {card.active ? "active" : "inactive"}
                </Badge>
            </Table.Td>
            <Table.Td>
                <Text size="xs" c="dimmed">{card.currentVersion.authorDisplayName}</Text>
            </Table.Td>
            <Table.Td>
                <Text size="xs" c="dimmed">{formatDate(card.createdAt)}</Text>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <>
            <Stack gap="md">
                <Title order={3}>Cards</Title>

                <Group gap="sm">
                    <TextInput
                        placeholder="Search title…"
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.currentTarget.value }))}
                        style={{ flex: 1 }}
                    />
                    <Select
                        placeholder="Status"
                        data={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]}
                        value={filters.active || null}
                        onChange={(v) => setFilters((f) => ({ ...f, active: v ?? "" }))}
                        clearable
                        w={130}
                    />
                    <Select
                        placeholder="Global"
                        data={[{ value: "true", label: "Global" }, { value: "false", label: "Not global" }]}
                        value={filters.isGlobal || null}
                        onChange={(v) => setFilters((f) => ({ ...f, isGlobal: v ?? "" }))}
                        clearable
                        w={140}
                    />
                </Group>

                {loading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <ScrollArea>
                        <Table striped highlightOnHover withTableBorder>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Title</Table.Th>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th>Global</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Author</Table.Th>
                                    <Table.Th>Created</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{rows}</Table.Tbody>
                        </Table>
                        <Text size="xs" c="dimmed" mt="xs">{cards.length} cards</Text>
                    </ScrollArea>
                )}
            </Stack>

            <Drawer
                opened={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.currentVersion.title ?? "Card"}
                position="right"
                size="md"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {selected && (
                    <CardDrawer
                        card={selected}
                        onClose={() => setSelected(null)}
                        onChanged={handleCardChanged}
                        apiBaseUrl={apiBaseUrl}
                    />
                )}
            </Drawer>
        </>
    );
}
