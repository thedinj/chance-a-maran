"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title, Table, Badge, Switch, Stack, Text, Loader, Center, Group,
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

    useEffect(() => {
        adminFetch("/api/admin/users")
            .then((r) => r.json())
            .then((d) => { if (d.ok) setUsers(d.data as AdminUser[]); setLoading(false); });
    }, [adminFetch]);

    function toggleAdmin(user: AdminUser) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                body: JSON.stringify({ isAdmin: !user.isAdmin }),
            });
            const data = await res.json();
            if (data.ok) {
                setUsers((prev) => prev.map((u) => u.id === user.id ? data.data as AdminUser : u));
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    return (
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
                            <Table.Tr key={user.id}>
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
                                <Table.Td>
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
    );
}
