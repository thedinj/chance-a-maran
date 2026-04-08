"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Badge, Switch, Button, TextInput, Stack, Group,
    Modal, Text, Loader, Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

interface AdminGame {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    createdAt: string;
    cardCount: number;
}

export default function GamesPage() {
    const adminFetch = useAdminFetch();
    const [games, setGames] = useState<AdminGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [modalOpen, setModalOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    function loadGames() {
        setLoading(true);
        adminFetch("/api/admin/games")
            .then((r) => r.json())
            .then((d) => { if (d.ok) setGames(d.data as AdminGame[]); setLoading(false); });
    }

    useEffect(() => { loadGames(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    function toggleActive(game: AdminGame) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/games/${game.id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !game.active }),
            });
            const data = await res.json();
            if (data.ok) {
                setGames((prev) => prev.map((g) => g.id === game.id ? data.data as AdminGame : g));
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    async function createGame() {
        if (!newName.trim()) return;
        setCreating(true);
        const res = await adminFetch("/api/admin/games", {
            method: "POST",
            body: JSON.stringify({ name: newName.trim() }),
        });
        const data = await res.json();
        setCreating(false);
        if (data.ok) {
            setGames((prev) => [...prev, data.data as AdminGame]);
            setNewName("");
            setModalOpen(false);
            notifications.show({ message: "Game created", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    return (
        <>
            <Stack gap="md">
                <Group justify="space-between">
                    <Title order={3}>Games</Title>
                    <Button size="sm" onClick={() => setModalOpen(true)}>New Game</Button>
                </Group>

                {loading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Name</Table.Th>
                                <Table.Th>Slug</Table.Th>
                                <Table.Th>Active</Table.Th>
                                <Table.Th>Cards</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {games.map((game) => (
                                <Table.Tr key={game.id}>
                                    <Table.Td>{game.name}</Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed" ff="monospace">{game.slug}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Switch
                                            checked={game.active}
                                            size="xs"
                                            disabled={isPending}
                                            onChange={() => toggleActive(game)}
                                        />
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{game.cardCount}</Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Stack>

            <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="New Game">
                <Stack gap="md">
                    <TextInput
                        label="Name"
                        placeholder="e.g. Catan"
                        value={newName}
                        onChange={(e) => setNewName(e.currentTarget.value)}
                        autoFocus
                    />
                    <Text size="xs" c="dimmed">
                        Slug will be auto-derived from the name.
                    </Text>
                    <Button onClick={() => void createGame()} loading={creating} fullWidth>
                        Create
                    </Button>
                </Stack>
            </Modal>
        </>
    );
}
