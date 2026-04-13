"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Badge, Switch, Stack, Text, Loader, Center, Group,
    Drawer, ScrollArea, TextInput, PasswordInput, Button, Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";
import { useAdminSession } from "@/lib/admin/useAdminSession";

interface AdminUser {
    id: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
    cardCount: number;
    createdAt: string;
}

export default function UsersPage() {
    const adminFetch = useAdminFetch();
    const { user: currentUser } = useAdminSession();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Drawer
    const [selected, setSelected] = useState<AdminUser | null>(null);

    // Edit fields
    const [editDisplayName, setEditDisplayName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editIsAdmin, setEditIsAdmin] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    // Password reset fields
    const [adminPassword, setAdminPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        adminFetch("/api/admin/users")
            .then((r) => r.json())
            .then((d) => {
                if (d.ok)
                    setUsers(
                        (d.data as AdminUser[]).sort((a, b) =>
                            a.displayName.localeCompare(b.displayName, undefined, {
                                sensitivity: "base",
                            })
                        )
                    );
                setLoading(false);
            });
    }, [adminFetch]);

    function openDrawer(user: AdminUser) {
        setSelected(user);
        setEditDisplayName(user.displayName);
        setEditEmail(user.email);
        setEditIsAdmin(user.isAdmin);
        setAdminPassword("");
        setNewPassword("");
        setConfirmPassword("");
    }

    function closeDrawer() {
        setSelected(null);
    }

    async function saveEdit() {
        if (!selected) return;
        setSavingEdit(true);
        const res = await adminFetch(`/api/admin/users/${selected.id}`, {
            method: "PATCH",
            body: JSON.stringify({
                displayName: editDisplayName,
                email: editEmail,
                isAdmin: editIsAdmin,
            }),
        });
        const data = await res.json();
        setSavingEdit(false);
        if (data.ok) {
            const updated = data.data as AdminUser;
            setUsers((prev) => prev.map((u) => u.id === selected.id ? updated : u));
            setSelected(updated);
            notifications.show({ message: "User updated", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function resetPassword() {
        if (!selected) return;
        if (newPassword !== confirmPassword) {
            notifications.show({ message: "Passwords do not match", color: "red" });
            return;
        }
        setSavingPassword(true);
        const res = await adminFetch(`/api/admin/users/${selected.id}/reset-password`, {
            method: "POST",
            body: JSON.stringify({ adminPassword, newPassword }),
        });
        const data = await res.json();
        setSavingPassword(false);
        if (data.ok) {
            setAdminPassword("");
            setNewPassword("");
            setConfirmPassword("");
            notifications.show({ message: "Password reset", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    // Keep toggle working from the table row directly (stopPropagation)
    function toggleAdmin(user: AdminUser) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                body: JSON.stringify({ isAdmin: !user.isAdmin }),
            });
            const data = await res.json();
            if (data.ok) {
                const updated = data.data as AdminUser;
                setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u));
                if (selected?.id === user.id) {
                    setSelected(updated);
                    setEditIsAdmin(updated.isAdmin);
                }
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    const passwordResetDisabled =
        !adminPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword;

    return (
        <>
            <Stack gap="md">
                <Title order={3}>Users</Title>

                {loading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Email</Table.Th>
                                <Table.Th>Display Name</Table.Th>
                                <Table.Th>Admin</Table.Th>
                                <Table.Th>Cards</Table.Th>
                                <Table.Th>Joined</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {users.map((user) => (
                                <Table.Tr
                                    key={user.id}
                                    style={{ cursor: "pointer" }}
                                    bg={selected?.id === user.id ? "var(--mantine-color-dark-6)" : undefined}
                                    onClick={() => openDrawer(user)}
                                >
                                    <Table.Td>
                                        <Group gap="xs">
                                            <Text size="sm">{user.email}</Text>
                                            {user.id === currentUser?.id && (
                                                <Badge size="xs" color="blue">you</Badge>
                                            )}
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{user.displayName}</Text>
                                    </Table.Td>
                                    <Table.Td onClick={(e) => e.stopPropagation()}>
                                        <Switch
                                            checked={user.isAdmin}
                                            size="xs"
                                            disabled={isPending || user.id === currentUser?.id}
                                            onChange={() => toggleAdmin(user)}
                                        />
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">{user.cardCount}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </Text>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Stack>

            <Drawer
                opened={!!selected}
                onClose={closeDrawer}
                title={selected?.displayName ?? "User"}
                position="right"
                size="sm"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {selected && (
                    <Stack gap="md">
                        <Stack gap={2}>
                            <Text size="xs" c="dimmed">
                                {selected.cardCount} card{selected.cardCount !== 1 ? "s" : ""} · joined {new Date(selected.createdAt).toLocaleDateString()}
                            </Text>
                        </Stack>

                        <Divider label="Edit profile" labelPosition="left" />

                        <TextInput
                            label="Display name"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.currentTarget.value)}
                        />
                        <TextInput
                            label="Email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.currentTarget.value)}
                        />
                        <Switch
                            label="Admin"
                            checked={editIsAdmin}
                            disabled={selected.id === currentUser?.id}
                            onChange={(e) => setEditIsAdmin(e.currentTarget.checked)}
                        />
                        <Button
                            onClick={() => void saveEdit()}
                            loading={savingEdit}
                            disabled={!editDisplayName.trim() || !editEmail.trim()}
                        >
                            Save changes
                        </Button>

                        <Divider label="Reset password" labelPosition="left" />

                        <PasswordInput
                            label="Your password"
                            placeholder="Confirm your identity"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.currentTarget.value)}
                        />
                        <PasswordInput
                            label="New password for user"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.currentTarget.value)}
                        />
                        <PasswordInput
                            label="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                            error={
                                confirmPassword && newPassword !== confirmPassword
                                    ? "Passwords do not match"
                                    : undefined
                            }
                        />
                        <Button
                            color="orange"
                            onClick={() => void resetPassword()}
                            loading={savingPassword}
                            disabled={passwordResetDisabled}
                        >
                            Reset password
                        </Button>
                    </Stack>
                )}
            </Drawer>
        </>
    );
}
