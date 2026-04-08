"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Badge, Switch, Button, Stack, Text, Loader, Center,
    Group, Modal, TextInput, NumberInput, Drawer, ScrollArea, Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

interface AdminCode {
    id: string;
    code: string;
    createdByEmail: string | null;
    expiresAt: string | null;
    isActive: boolean;
    useCount: number;
    maxUses: number | null;
    createdAt: string;
}

export default function InvitationCodesPage() {
    const adminFetch = useAdminFetch();
    const [codes, setCodes] = useState<AdminCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Create modal
    const [createOpen, setCreateOpen] = useState(false);
    const [newCode, setNewCode] = useState("");
    const [newExpiresAt, setNewExpiresAt] = useState<string>("");
    const [newMaxUses, setNewMaxUses] = useState<number | string>("");
    const [creating, setCreating] = useState(false);

    // Edit drawer
    const [selected, setSelected] = useState<AdminCode | null>(null);
    const [editMaxUses, setEditMaxUses] = useState<number | string>("");
    const [editExpiresAt, setEditExpiresAt] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        adminFetch("/api/admin/invitation-codes")
            .then((r) => r.json())
            .then((d) => { if (d.ok) setCodes(d.data as AdminCode[]); setLoading(false); });
    }, [adminFetch]);

    function openDrawer(c: AdminCode) {
        setSelected(c);
        setEditMaxUses(c.maxUses ?? "");
        setEditExpiresAt(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
    }

    function toggleActive(c: AdminCode) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/invitation-codes/${c.id}`, {
                method: "PATCH",
                body: JSON.stringify({ isActive: !c.isActive }),
            });
            const data = await res.json();
            if (data.ok) {
                const updated = data.data as AdminCode;
                setCodes((prev) => prev.map((x) => x.id === c.id ? updated : x));
                if (selected?.id === c.id) setSelected(updated);
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    async function saveEdit() {
        if (!selected) return;
        setSaving(true);
        const res = await adminFetch(`/api/admin/invitation-codes/${selected.id}`, {
            method: "PATCH",
            body: JSON.stringify({
                maxUses: typeof editMaxUses === "number" ? editMaxUses : null,
                expiresAt: editExpiresAt || null,
            }),
        });
        const data = await res.json();
        setSaving(false);
        if (data.ok) {
            const updated = data.data as AdminCode;
            setCodes((prev) => prev.map((x) => x.id === selected.id ? updated : x));
            setSelected(updated);
            notifications.show({ message: "Code updated", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function createCode() {
        setCreating(true);
        const res = await adminFetch("/api/admin/invitation-codes", {
            method: "POST",
            body: JSON.stringify({
                code: newCode,
                expiresAt: newExpiresAt || undefined,
                maxUses: typeof newMaxUses === "number" ? newMaxUses : undefined,
            }),
        });
        const data = await res.json();
        setCreating(false);
        if (data.ok) {
            setCodes((prev) => [data.data as AdminCode, ...prev]);
            setNewCode("");
            setNewExpiresAt("");
            setNewMaxUses("");
            setCreateOpen(false);
            notifications.show({ message: "Code created", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    return (
        <>
            <Stack gap="md">
                <Group justify="space-between">
                    <Title order={3}>Invitation Codes</Title>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>New Code</Button>
                </Group>

                {loading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Code</Table.Th>
                                <Table.Th>Created by</Table.Th>
                                <Table.Th>Uses</Table.Th>
                                <Table.Th>Expires</Table.Th>
                                <Table.Th>Active</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {codes.map((c) => (
                                <Table.Tr
                                    key={c.id}
                                    style={{ cursor: "pointer" }}
                                    bg={selected?.id === c.id ? "var(--mantine-color-dark-6)" : undefined}
                                    onClick={() => openDrawer(c)}
                                >
                                    <Table.Td>
                                        <Text size="sm" ff="monospace">{c.code}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed">{c.createdByEmail ?? "—"}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        {c.maxUses !== null ? (
                                            <Badge
                                                size="xs"
                                                color={c.useCount >= c.maxUses ? "red" : "blue"}
                                            >
                                                {c.useCount} / {c.maxUses}
                                            </Badge>
                                        ) : (
                                            <Text size="xs" c="dimmed">{c.useCount} / ∞</Text>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed">
                                            {c.expiresAt
                                                ? new Date(c.expiresAt).toLocaleDateString()
                                                : "never"}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td onClick={(e) => e.stopPropagation()}>
                                        <Switch
                                            checked={c.isActive}
                                            size="xs"
                                            disabled={isPending}
                                            onChange={() => toggleActive(c)}
                                        />
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Stack>

            {/* Edit drawer */}
            <Drawer
                opened={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.code ?? "Code"}
                position="right"
                size="sm"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {selected && (
                    <Stack gap="md">
                        <Stack gap={4}>
                            <Text size="xl" ff="monospace" fw={700}>{selected.code}</Text>
                            <Text size="xs" c="dimmed">
                                Created by {selected.createdByEmail ?? "system"} · {new Date(selected.createdAt).toLocaleDateString()}
                            </Text>
                            <Text size="xs" c="dimmed">Used {selected.useCount} time{selected.useCount !== 1 ? "s" : ""}</Text>
                        </Stack>

                        <Divider />

                        <NumberInput
                            label="Max uses"
                            description="Leave empty for unlimited"
                            placeholder="Unlimited"
                            value={editMaxUses}
                            onChange={setEditMaxUses}
                            min={1}
                            allowDecimal={false}
                        />
                        <TextInput
                            label="Expires"
                            description="Leave empty to never expire"
                            placeholder="YYYY-MM-DD"
                            value={editExpiresAt}
                            onChange={(e) => setEditExpiresAt(e.currentTarget.value)}
                        />
                        <Switch
                            label="Active"
                            checked={selected.isActive}
                            disabled={isPending}
                            onChange={() => toggleActive(selected)}
                        />
                        <Button onClick={() => void saveEdit()} loading={saving}>
                            Save changes
                        </Button>
                    </Stack>
                )}
            </Drawer>

            {/* Create modal */}
            <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Invitation Code">
                <Stack gap="md">
                    <TextInput
                        label="Code"
                        placeholder="e.g. SUMMER25 or LAUNCH-2025"
                        value={newCode}
                        onChange={(e) => setNewCode(e.currentTarget.value)}
                        required
                        description="Will be normalized to uppercase. Letters, numbers, and hyphens only."
                    />
                    <NumberInput
                        label="Max uses (optional)"
                        placeholder="Unlimited"
                        value={newMaxUses}
                        onChange={setNewMaxUses}
                        min={1}
                        allowDecimal={false}
                    />
                    <TextInput
                        label="Expires (optional)"
                        placeholder="YYYY-MM-DD or leave empty"
                        value={newExpiresAt}
                        onChange={(e) => setNewExpiresAt(e.currentTarget.value)}
                    />
                    <Button
                        onClick={() => void createCode()}
                        loading={creating}
                        disabled={!newCode.trim()}
                        fullWidth
                    >
                        Create Code
                    </Button>
                </Stack>
            </Modal>
        </>
    );
}
