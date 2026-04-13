"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Switch, Button, TextInput, Stack, Group,
    Modal, Text, Loader, Center, ActionIcon, Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

interface AdminGame {
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
    cardCount: number;
}

export default function GamesPage() {
    const adminFetch = useAdminFetch();
    const [games, setGames] = useState<AdminGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [editTarget, setEditTarget] = useState<AdminGame | null>(null);
    const [editName, setEditName] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AdminGame | null>(null);
    const [deleteImpact, setDeleteImpact] = useState<{ cardVersionCount: number; sessionCount: number } | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        setLoading(true);
        adminFetch("/api/admin/games")
            .then((r) => r.json())
            .then((d) => {
                if (d.ok)
                    setGames(
                        (d.data as AdminGame[]).sort((a, b) =>
                            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
                        )
                    );
                setLoading(false);
            });
    }, [adminFetch]);

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

    function openEdit(game: AdminGame) {
        setEditTarget(game);
        setEditName(game.name);
    }

    async function saveEdit() {
        if (!editTarget || !editName.trim()) return;
        setSaving(true);
        const res = await adminFetch(`/api/admin/games/${editTarget.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: editName.trim() }),
        });
        const data = await res.json();
        setSaving(false);
        if (data.ok) {
            setGames((prev) =>
                prev
                    .map((g) => (g.id === editTarget.id ? (data.data as AdminGame) : g))
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
            );
            setEditTarget(null);
            notifications.show({ message: "Game updated", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function confirmDelete(game: AdminGame) {
        const res = await adminFetch(`/api/admin/games/${game.id}?dryRun=true`, { method: "DELETE" });
        const data = await res.json();
        if (data.ok) {
            setDeleteImpact(data.data);
            setDeleteTarget(game);
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function executeDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        const res = await adminFetch(`/api/admin/games/${deleteTarget.id}`, { method: "DELETE" });
        const data = await res.json();
        setDeleting(false);
        if (data.ok) {
            setGames((prev) => prev.filter((g) => g.id !== deleteTarget.id));
            setDeleteTarget(null);
            setDeleteImpact(null);
            notifications.show({ message: "Game deleted", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
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
            setGames((prev) =>
                [...prev, data.data as AdminGame].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
            );
            setNewName("");
            setCreateOpen(false);
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
                    <Button size="sm" onClick={() => setCreateOpen(true)}>New Game</Button>
                </Group>

                {loading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Name</Table.Th>
                                <Table.Th>Active</Table.Th>
                                <Table.Th>Cards</Table.Th>
                                <Table.Th />
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {games.map((game) => (
                                <Table.Tr key={game.id}>
                                    <Table.Td>{game.name}</Table.Td>
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
                                    <Table.Td>
                                        <Group gap={4}>
                                            <Tooltip label="Edit">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    onClick={() => openEdit(game)}
                                                >
                                                    ✏
                                                </ActionIcon>
                                            </Tooltip>
                                            <Tooltip label="Delete permanently">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    color="red"
                                                    onClick={() => void confirmDelete(game)}
                                                >
                                                    🗑
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Stack>

            <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Game">
                <Stack gap="md">
                    <TextInput
                        label="Name"
                        placeholder="e.g. Catan"
                        value={newName}
                        onChange={(e) => setNewName(e.currentTarget.value)}
                        autoFocus
                    />
                    <Button onClick={() => void createGame()} loading={creating} fullWidth>
                        Create
                    </Button>
                </Stack>
            </Modal>

            <Modal
                opened={!!editTarget}
                onClose={() => setEditTarget(null)}
                title="Edit Game"
            >
                <Stack gap="md">
                    <TextInput
                        label="Name"
                        value={editName}
                        onChange={(e) => setEditName(e.currentTarget.value)}
                        autoFocus
                    />
                    <Button
                        onClick={() => void saveEdit()}
                        loading={saving}
                        disabled={!editName.trim()}
                        fullWidth
                    >
                        Save
                    </Button>
                </Stack>
            </Modal>
            <Modal
                opened={!!deleteTarget}
                onClose={() => { setDeleteTarget(null); setDeleteImpact(null); }}
                title="Delete Game"
            >
                <Stack gap="md">
                    <Text size="sm">
                        Permanently delete &ldquo;{deleteTarget?.name}&rdquo;?
                        {deleteImpact && (
                            <> This will untag {deleteImpact.cardVersionCount} card version(s) and
                            remove it from {deleteImpact.sessionCount} session filter(s).</>
                        )}
                    </Text>
                    <Group justify="flex-end">
                        <Button
                            variant="default"
                            onClick={() => { setDeleteTarget(null); setDeleteImpact(null); }}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="red"
                            onClick={() => void executeDelete()}
                            loading={deleting}
                        >
                            Delete
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    );
}
