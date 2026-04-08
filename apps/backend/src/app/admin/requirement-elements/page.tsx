"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Switch, Button, TextInput, Stack, Group,
    Modal, Text, Loader, Center, ActionIcon, Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

interface AdminElement {
    id: string;
    title: string;
    active: boolean;
    defaultAvailable: boolean;
    cardCount: number;
}

export default function RequirementElementsPage() {
    const adminFetch = useAdminFetch();
    const [elements, setElements] = useState<AdminElement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [createOpen, setCreateOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [creating, setCreating] = useState(false);
    const [editTarget, setEditTarget] = useState<AdminElement | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [saving, setSaving] = useState(false);

    function loadElements() {
        setLoading(true);
        adminFetch("/api/admin/requirement-elements")
            .then((r) => r.json())
            .then((d) => { if (d.ok) setElements(d.data as AdminElement[]); setLoading(false); });
    }

    useEffect(() => { loadElements(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    function toggleActive(el: AdminElement) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/requirement-elements/${el.id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !el.active }),
            });
            const data = await res.json();
            if (data.ok) {
                setElements((prev) => prev.map((e) => e.id === el.id ? data.data as AdminElement : e));
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    function toggleDefaultAvailable(el: AdminElement) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/requirement-elements/${el.id}`, {
                method: "PATCH",
                body: JSON.stringify({ defaultAvailable: !el.defaultAvailable }),
            });
            const data = await res.json();
            if (data.ok) {
                setElements((prev) => prev.map((e) => e.id === el.id ? data.data as AdminElement : e));
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    function openEdit(el: AdminElement) {
        setEditTarget(el);
        setEditTitle(el.title);
    }

    async function saveEdit() {
        if (!editTarget || !editTitle.trim()) return;
        setSaving(true);
        const res = await adminFetch(`/api/admin/requirement-elements/${editTarget.id}`, {
            method: "PATCH",
            body: JSON.stringify({ title: editTitle.trim() }),
        });
        const data = await res.json();
        setSaving(false);
        if (data.ok) {
            setElements((prev) => prev.map((e) => e.id === editTarget.id ? data.data as AdminElement : e));
            setEditTarget(null);
            notifications.show({ message: "Element updated", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function createElement() {
        if (!newTitle.trim()) return;
        setCreating(true);
        const res = await adminFetch("/api/admin/requirement-elements", {
            method: "POST",
            body: JSON.stringify({ title: newTitle.trim() }),
        });
        const data = await res.json();
        setCreating(false);
        if (data.ok) {
            setElements((prev) => [...prev, { ...(data.data as AdminElement), cardCount: 0 }]);
            setNewTitle("");
            setCreateOpen(false);
            notifications.show({ message: "Element created", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    return (
        <>
            <Stack gap="md">
                <Group justify="space-between">
                    <Title order={3}>Requirement Elements</Title>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>New Element</Button>
                </Group>

                {loading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Title</Table.Th>
                                <Table.Th>Active</Table.Th>
                                <Table.Th>Default On</Table.Th>
                                <Table.Th>Cards using</Table.Th>
                                <Table.Th />
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {elements.map((el) => (
                                <Table.Tr key={el.id}>
                                    <Table.Td>{el.title}</Table.Td>
                                    <Table.Td>
                                        <Switch
                                            checked={el.active}
                                            size="xs"
                                            disabled={isPending}
                                            onChange={() => toggleActive(el)}
                                        />
                                    </Table.Td>
                                    <Table.Td>
                                        <Switch
                                            checked={el.defaultAvailable}
                                            size="xs"
                                            disabled={isPending || !el.active}
                                            onChange={() => toggleDefaultAvailable(el)}
                                        />
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{el.cardCount}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Tooltip label="Edit">
                                            <ActionIcon
                                                variant="subtle"
                                                size="sm"
                                                onClick={() => openEdit(el)}
                                            >
                                                ✏
                                            </ActionIcon>
                                        </Tooltip>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Stack>

            <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Requirement Element">
                <Stack gap="md">
                    <TextInput
                        label="Title"
                        placeholder="e.g. Jenga"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.currentTarget.value)}
                        autoFocus
                    />
                    <Button onClick={() => void createElement()} loading={creating} fullWidth>
                        Create
                    </Button>
                </Stack>
            </Modal>

            <Modal
                opened={!!editTarget}
                onClose={() => setEditTarget(null)}
                title="Edit Requirement Element"
            >
                <Stack gap="md">
                    <TextInput
                        label="Title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.currentTarget.value)}
                        autoFocus
                    />
                    <Button
                        onClick={() => void saveEdit()}
                        loading={saving}
                        disabled={!editTitle.trim()}
                        fullWidth
                    >
                        Save
                    </Button>
                </Stack>
            </Modal>
        </>
    );
}
