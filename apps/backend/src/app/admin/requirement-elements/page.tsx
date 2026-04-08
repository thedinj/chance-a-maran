"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Switch, Button, TextInput, Stack, Group,
    Modal, Text, Loader, Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

interface AdminElement {
    id: string;
    title: string;
    active: boolean;
    cardCount: number;
}

export default function RequirementElementsPage() {
    const adminFetch = useAdminFetch();
    const [elements, setElements] = useState<AdminElement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [modalOpen, setModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [creating, setCreating] = useState(false);

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
            setModalOpen(false);
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
                    <Button size="sm" onClick={() => setModalOpen(true)}>New Element</Button>
                </Group>

                {loading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Title</Table.Th>
                                <Table.Th>Active</Table.Th>
                                <Table.Th>Cards using</Table.Th>
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
                                        <Text size="sm">{el.cardCount}</Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Stack>

            <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="New Requirement Element">
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
        </>
    );
}
