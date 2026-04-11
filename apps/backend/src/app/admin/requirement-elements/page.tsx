"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title,
    Table,
    Switch,
    Button,
    TextInput,
    Stack,
    Group,
    Modal,
    Text,
    Loader,
    Center,
    ActionIcon,
    Tooltip,
    Select,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

interface AdminGroup {
    id: string;
    name: string;
    sortOrder: number;
    locked: boolean;
    elementCount: number;
}

interface AdminElement {
    id: string;
    title: string;
    active: boolean;
    defaultAvailable: boolean;
    cardCount: number;
    groupId: string | null;
    groupName: string | null;
}

export default function RequirementElementsPage() {
    const adminFetch = useAdminFetch();
    const [elements, setElements] = useState<AdminElement[]>([]);
    const [groups, setGroups] = useState<AdminGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [groupFilter, setGroupFilter] = useState<string | null>("__all__");
    const [createOpen, setCreateOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [creating, setCreating] = useState(false);
    const [editTarget, setEditTarget] = useState<AdminElement | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editGroupId, setEditGroupId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<AdminElement | null>(null);
    const [deleteImpact, setDeleteImpact] = useState<{
        cardVersionCount: number;
        sessionCount: number;
        userCount: number;
    } | null>(null);
    const [deleting, setDeleting] = useState(false);

    function loadData() {
        setLoading(true);
        Promise.all([
            adminFetch("/api/admin/requirement-elements").then((r) => r.json()),
            adminFetch("/api/admin/element-groups").then((r) => r.json()),
        ]).then(([elementsData, groupsData]) => {
            if (elementsData.ok) setElements(elementsData.data as AdminElement[]);
            if (groupsData.ok) setGroups(groupsData.data as AdminGroup[]);
            setLoading(false);
        });
    }

    useEffect(() => {
        loadData();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredElements = elements.filter((el) => {
        if (groupFilter === "__all__") return true;
        if (groupFilter === "__ungrouped__") return el.groupId === null;
        return el.groupId === groupFilter;
    });

    const groupSelectData = [
        { value: "__all__", label: "All groups" },
        { value: "__ungrouped__", label: "Ungrouped" },
        ...groups.map((g) => ({ value: g.id, label: g.name })),
    ];

    const groupDropdownData = [
        { value: "", label: "None" },
        ...groups.map((g) => ({ value: g.id, label: g.name })),
    ];

    function toggleActive(el: AdminElement) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/requirement-elements/${el.id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !el.active }),
            });
            const data = await res.json();
            if (data.ok) {
                setElements((prev) =>
                    prev.map((e) => (e.id === el.id ? (data.data as AdminElement) : e))
                );
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
                setElements((prev) =>
                    prev.map((e) => (e.id === el.id ? (data.data as AdminElement) : e))
                );
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    function openEdit(el: AdminElement) {
        setEditTarget(el);
        setEditTitle(el.title);
        setEditGroupId(el.groupId);
    }

    async function saveEdit() {
        if (!editTarget || !editTitle.trim()) return;
        setSaving(true);
        const res = await adminFetch(`/api/admin/requirement-elements/${editTarget.id}`, {
            method: "PATCH",
            body: JSON.stringify({
                title: editTitle.trim(),
                groupId: editGroupId || null,
            }),
        });
        const data = await res.json();
        setSaving(false);
        if (data.ok) {
            setElements((prev) =>
                prev
                    .map((e) => (e.id === editTarget.id ? (data.data as AdminElement) : e))
                    .sort((a, b) => a.title.localeCompare(b.title))
            );
            setEditTarget(null);
            notifications.show({ message: "Element updated", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function confirmDelete(el: AdminElement) {
        const res = await adminFetch(`/api/admin/requirement-elements/${el.id}?dryRun=true`, {
            method: "DELETE",
        });
        const data = await res.json();
        if (data.ok) {
            setDeleteImpact(data.data);
            setDeleteTarget(el);
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function executeDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        const res = await adminFetch(`/api/admin/requirement-elements/${deleteTarget.id}`, {
            method: "DELETE",
        });
        const data = await res.json();
        setDeleting(false);
        if (data.ok) {
            setElements((prev) => prev.filter((e) => e.id !== deleteTarget.id));
            setDeleteTarget(null);
            setDeleteImpact(null);
            notifications.show({ message: "Element deleted", color: "green" });
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
            setElements((prev) =>
                [...prev, { ...(data.data as AdminElement), cardCount: 0 }].sort((a, b) =>
                    a.title.localeCompare(b.title)
                )
            );
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
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        New Element
                    </Button>
                </Group>

                <Select
                    data={groupSelectData}
                    value={groupFilter}
                    onChange={setGroupFilter}
                    w={220}
                    size="sm"
                />

                {loading ? (
                    <Center py="xl">
                        <Loader />
                    </Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Title</Table.Th>
                                <Table.Th>Group</Table.Th>
                                <Table.Th>Active</Table.Th>
                                <Table.Th>Default On</Table.Th>
                                <Table.Th>Cards using</Table.Th>
                                <Table.Th />
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {filteredElements.map((el) => (
                                <Table.Tr key={el.id}>
                                    <Table.Td>{el.title}</Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c={el.groupName ? undefined : "dimmed"}>
                                            {el.groupName ?? "—"}
                                        </Text>
                                    </Table.Td>
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
                                        <Group gap={4}>
                                            <Tooltip label="Edit">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    onClick={() => openEdit(el)}
                                                >
                                                    ✏
                                                </ActionIcon>
                                            </Tooltip>
                                            <Tooltip label="Delete permanently">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="sm"
                                                    color="red"
                                                    onClick={() => void confirmDelete(el)}
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

            <Modal
                opened={createOpen}
                onClose={() => setCreateOpen(false)}
                title="New Requirement Element"
            >
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
                    <Select
                        label="Group"
                        data={groupDropdownData}
                        value={editGroupId ?? ""}
                        onChange={(v) => setEditGroupId(v || null)}
                        clearable
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

            <Modal
                opened={!!deleteTarget}
                onClose={() => {
                    setDeleteTarget(null);
                    setDeleteImpact(null);
                }}
                title="Delete Requirement Element"
            >
                <Stack gap="md">
                    <Text size="sm">
                        Permanently delete &ldquo;{deleteTarget?.title}&rdquo;?
                        {deleteImpact && (
                            <>
                                {" "}
                                This will remove it from {deleteImpact.cardVersionCount} card
                                version(s), {deleteImpact.sessionCount} session filter(s), and{" "}
                                {deleteImpact.userCount} user element selection(s).
                            </>
                        )}
                    </Text>
                    <Group justify="flex-end">
                        <Button
                            variant="default"
                            onClick={() => {
                                setDeleteTarget(null);
                                setDeleteImpact(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button color="red" onClick={() => void executeDelete()} loading={deleting}>
                            Delete
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    );
}
