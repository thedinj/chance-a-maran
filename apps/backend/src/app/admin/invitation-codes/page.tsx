"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Badge, Switch, Button, Stack, Text, Loader, Center,
    Group, Modal, TextInput, NumberInput,
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
    const [modalOpen, setModalOpen] = useState(false);
    const [code, setCode] = useState("");
    const [expiresAt, setExpiresAt] = useState<string>("");
    const [maxUses, setMaxUses] = useState<number | string>("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        adminFetch("/api/admin/invitation-codes")
            .then((r) => r.json())
            .then((d) => { if (d.ok) setCodes(d.data as AdminCode[]); setLoading(false); });
    }, [adminFetch]);

    function toggleActive(c: AdminCode) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/invitation-codes/${c.id}`, {
                method: "PATCH",
                body: JSON.stringify({ isActive: !c.isActive }),
            });
            const data = await res.json();
            if (data.ok) {
                setCodes((prev) => prev.map((x) => x.id === c.id ? data.data as AdminCode : x));
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    async function createCode() {
        setCreating(true);
        const res = await adminFetch("/api/admin/invitation-codes", {
            method: "POST",
            body: JSON.stringify({
                code,
                expiresAt: expiresAt || undefined,
                maxUses: typeof maxUses === "number" ? maxUses : undefined,
            }),
        });
        const data = await res.json();
        setCreating(false);
        if (data.ok) {
            setCodes((prev) => [data.data as AdminCode, ...prev]);
            setCode("");
            setExpiresAt("");
            setMaxUses("");
            setModalOpen(false);
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
                    <Button size="sm" onClick={() => setModalOpen(true)}>New Code</Button>
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
                                <Table.Tr key={c.id}>
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
                                            <Text size="xs" c="dimmed">
                                                {c.useCount} / ∞
                                            </Text>
                                        )}
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed">
                                            {c.expiresAt
                                                ? new Date(c.expiresAt).toLocaleDateString()
                                                : "never"}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
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

            <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="New Invitation Code">
                <Stack gap="md">
                    <TextInput
                        label="Code"
                        placeholder="e.g. SUMMER25 or LAUNCH-2025"
                        value={code}
                        onChange={(e) => setCode(e.currentTarget.value)}
                        required
                        description="Will be normalized to uppercase. Letters, numbers, and hyphens only."
                    />
                    <NumberInput
                        label="Max uses (optional)"
                        placeholder="Unlimited"
                        value={maxUses}
                        onChange={setMaxUses}
                        min={1}
                        allowDecimal={false}
                    />
                    <TextInput
                        label="Expires (optional)"
                        placeholder="YYYY-MM-DD or leave empty"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.currentTarget.value)}
                    />
                    <Button
                        onClick={() => void createCode()}
                        loading={creating}
                        disabled={!code.trim()}
                        fullWidth
                    >
                        Create Code
                    </Button>
                </Stack>
            </Modal>
        </>
    );
}
