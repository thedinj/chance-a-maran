"use client";

import { useEffect, useState } from "react";
import { Title, Stack, Switch, Text, Paper, Loader, Center } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

export default function SettingsPage() {
    const adminFetch = useAdminFetch();
    const [inviteCodeRequired, setInviteCodeRequired] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        adminFetch("/api/admin/settings")
            .then((r) => r.json())
            .then((d) => {
                if (d.ok) setInviteCodeRequired(d.data.inviteCodeRequired as boolean);
                setLoading(false);
            });
    }, [adminFetch]);

    async function toggle() {
        setSaving(true);
        const next = !inviteCodeRequired;
        const res = await adminFetch("/api/admin/settings", {
            method: "PATCH",
            body: JSON.stringify({ inviteCodeRequired: next }),
        });
        const data = await res.json();
        setSaving(false);
        if (data.ok) {
            setInviteCodeRequired(data.data.inviteCodeRequired as boolean);
            notifications.show({ message: "Setting saved", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    if (loading) return <Center py="xl"><Loader /></Center>;

    return (
        <Stack gap="md">
            <Title order={3}>Settings</Title>
            <Paper withBorder p="md">
                <Stack gap={4}>
                    <Switch
                        label="Require invitation code for registration"
                        checked={inviteCodeRequired}
                        onChange={() => void toggle()}
                        disabled={saving}
                    />
                    <Text size="xs" c="dimmed">
                        When enabled, new users must provide a valid invitation code to register.
                    </Text>
                </Stack>
            </Paper>
        </Stack>
    );
}
