"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
    Title,
    Table,
    Badge,
    Switch,
    Button,
    Stack,
    Text,
    Loader,
    Center,
    Group,
    Modal,
    TextInput,
    Drawer,
    ScrollArea,
    NumberInput,
    ActionIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";
import type { SoundboardSound } from "@chance/core";

export default function SoundboardPage() {
    const adminFetch = useAdminFetch();
    const apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const [sounds, setSounds] = useState<SoundboardSound[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Create modal
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmoji, setNewEmoji] = useState("");
    const [newMediaId, setNewMediaId] = useState<string | null>(null);
    const [newFileName, setNewFileName] = useState("");
    const [creating, setCreating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit drawer
    const [selected, setSelected] = useState<SoundboardSound | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmoji, setEditEmoji] = useState("");
    const [editSortOrder, setEditSortOrder] = useState<number | string>(0);
    const [editMediaId, setEditMediaId] = useState<string | null>(null);
    const [editFileName, setEditFileName] = useState("");
    const [saving, setSaving] = useState(false);
    const editFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        adminFetch("/api/admin/soundboard")
            .then((r) => r.json())
            .then((d) => {
                if (d.ok) setSounds(d.data as SoundboardSound[]);
                setLoading(false);
            });
    }, [adminFetch]);

    function openDrawer(s: SoundboardSound) {
        setSelected(s);
        setEditName(s.name);
        setEditEmoji(s.emoji);
        setEditSortOrder(s.sortOrder);
        setEditMediaId(null);
        setEditFileName("");
    }

    function toggleActive(s: SoundboardSound) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/soundboard/${s.id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !s.active }),
            });
            const data = await res.json();
            if (data.ok) {
                const updated = data.data as SoundboardSound;
                setSounds((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
                if (selected?.id === s.id) setSelected(updated);
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    async function uploadAudio(file: File): Promise<string | null> {
        const form = new FormData();
        form.append("file", file);
        const res = await adminFetch("/api/media", { method: "POST", body: form });
        const data = await res.json();
        if (!data.ok) {
            notifications.show({ message: data.error?.message ?? "Upload failed", color: "red" });
            return null;
        }
        return (data.data as { mediaId: string }).mediaId;
    }

    async function handleCreate() {
        if (!newName.trim() || !newEmoji.trim() || !newMediaId) return;
        setCreating(true);
        const res = await adminFetch("/api/admin/soundboard", {
            method: "POST",
            body: JSON.stringify({
                name: newName.trim(),
                emoji: newEmoji.trim(),
                mediaId: newMediaId,
            }),
        });
        const data = await res.json();
        setCreating(false);
        if (data.ok) {
            setSounds((prev) =>
                [...prev, data.data as SoundboardSound].sort(
                    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
                )
            );
            setCreateOpen(false);
            setNewName("");
            setNewEmoji("");
            setNewMediaId(null);
            setNewFileName("");
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function handleSaveEdit() {
        if (!selected) return;
        setSaving(true);
        const mediaId = editMediaId ?? undefined;
        const res = await adminFetch(`/api/admin/soundboard/${selected.id}`, {
            method: "PATCH",
            body: JSON.stringify({
                name: editName.trim(),
                emoji: editEmoji.trim(),
                sortOrder: Number(editSortOrder),
                ...(mediaId ? { mediaId } : {}),
            }),
        });
        const data = await res.json();
        setSaving(false);
        if (data.ok) {
            const updated = data.data as SoundboardSound;
            setSounds((prev) =>
                prev
                    .map((x) => (x.id === selected.id ? updated : x))
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            );
            setSelected(updated);
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function handleDelete() {
        if (!selected) return;
        const res = await adminFetch(`/api/admin/soundboard/${selected.id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.ok) {
            setSounds((prev) => prev.filter((x) => x.id !== selected.id));
            setSelected(null);
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    if (loading)
        return (
            <Center h={200}>
                <Loader />
            </Center>
        );

    return (
        <Stack>
            <Group justify="space-between">
                <Title order={2}>Soundboard</Title>
                <Button onClick={() => setCreateOpen(true)}>Add Sound</Button>
            </Group>

            <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Emoji</Table.Th>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Order</Table.Th>
                        <Table.Th>Preview</Table.Th>
                        <Table.Th>Active</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {sounds.map((s) => (
                        <Table.Tr
                            key={s.id}
                            onClick={() => openDrawer(s)}
                            style={{ cursor: "pointer" }}
                        >
                            <Table.Td style={{ fontSize: "1.5rem" }}>{s.emoji}</Table.Td>
                            <Table.Td>{s.name}</Table.Td>
                            <Table.Td>{s.sortOrder}</Table.Td>
                            <Table.Td onClick={(e) => e.stopPropagation()}>
                                <ActionIcon
                                    variant="subtle"
                                    onClick={() =>
                                        new Audio(`${apiBaseUrl}/api/media/${s.mediaId}`).play()
                                    }
                                    title="Preview"
                                >
                                    ▶
                                </ActionIcon>
                            </Table.Td>
                            <Table.Td onClick={(e) => e.stopPropagation()}>
                                <Switch
                                    checked={s.active}
                                    onChange={() => toggleActive(s)}
                                    disabled={isPending}
                                />
                            </Table.Td>
                        </Table.Tr>
                    ))}
                    {sounds.length === 0 && (
                        <Table.Tr>
                            <Table.Td colSpan={5}>
                                <Text c="dimmed" ta="center" py="md">
                                    No sounds yet
                                </Text>
                            </Table.Td>
                        </Table.Tr>
                    )}
                </Table.Tbody>
            </Table>

            {/* Create modal */}
            <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Add Sound">
                <Stack>
                    <TextInput
                        label="Emoji"
                        value={newEmoji}
                        onChange={(e) => setNewEmoji(e.currentTarget.value)}
                    />
                    <TextInput
                        label="Name"
                        placeholder="Airhorn"
                        value={newName}
                        onChange={(e) => setNewName(e.currentTarget.value)}
                    />
                    <Stack gap={4}>
                        <Text size="sm" fw={500}>
                            Audio file (MP3, max 1 MB, 10 s)
                        </Text>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/mpeg"
                            style={{ display: "none" }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setNewFileName(file.name);
                                const mediaId = await uploadAudio(file);
                                if (mediaId) setNewMediaId(mediaId);
                            }}
                        />
                        <Group>
                            <Button
                                variant="default"
                                size="xs"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Choose file
                            </Button>
                            {newFileName && (
                                <Text size="xs" c="dimmed">
                                    {newFileName}
                                </Text>
                            )}
                            {newMediaId && (
                                <audio
                                    controls
                                    src={`${apiBaseUrl}/api/media/${newMediaId}`}
                                    style={{ height: 32 }}
                                />
                            )}
                        </Group>
                    </Stack>
                    <Button
                        onClick={handleCreate}
                        loading={creating}
                        disabled={!newName.trim() || !newEmoji.trim() || !newMediaId}
                    >
                        Create
                    </Button>
                </Stack>
            </Modal>

            {/* Edit drawer */}
            <Drawer
                opened={!!selected}
                onClose={() => setSelected(null)}
                title={selected ? `Edit: ${selected.emoji} ${selected.name}` : ""}
                position="right"
            >
                {selected && (
                    <ScrollArea h="100%">
                        <Stack p="md">
                            <TextInput
                                label="Emoji"
                                value={editEmoji}
                                onChange={(e) => setEditEmoji(e.currentTarget.value)}
                            />
                            <TextInput
                                label="Name"
                                value={editName}
                                onChange={(e) => setEditName(e.currentTarget.value)}
                            />
                            <NumberInput
                                label="Sort order"
                                value={editSortOrder}
                                onChange={setEditSortOrder}
                                min={0}
                            />
                            <Stack gap={4}>
                                <Text size="sm" fw={500}>
                                    Replace audio (optional)
                                </Text>
                                <audio
                                    controls
                                    src={`${apiBaseUrl}/api/media/${editMediaId ?? selected.mediaId}`}
                                    style={{ width: "100%" }}
                                />
                                <input
                                    ref={editFileInputRef}
                                    type="file"
                                    accept="audio/mpeg"
                                    style={{ display: "none" }}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setEditFileName(file.name);
                                        const mediaId = await uploadAudio(file);
                                        if (mediaId) setEditMediaId(mediaId);
                                    }}
                                />
                                <Group>
                                    <Button
                                        variant="default"
                                        size="xs"
                                        onClick={() => editFileInputRef.current?.click()}
                                    >
                                        Replace file
                                    </Button>
                                    {editFileName && (
                                        <Text size="xs" c="dimmed">
                                            {editFileName}
                                        </Text>
                                    )}
                                </Group>
                            </Stack>
                            <Switch
                                label="Active"
                                checked={selected.active}
                                onChange={() => toggleActive(selected)}
                                disabled={isPending}
                            />
                            <Button onClick={handleSaveEdit} loading={saving}>
                                Save changes
                            </Button>
                            <Button color="red" variant="subtle" onClick={handleDelete}>
                                Delete
                            </Button>
                        </Stack>
                    </ScrollArea>
                )}
            </Drawer>
        </Stack>
    );
}
