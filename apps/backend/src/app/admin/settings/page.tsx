"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Title,
    Stack,
    Switch,
    Text,
    Paper,
    Loader,
    Center,
    PasswordInput,
    Select,
    Button,
    Group,
    Badge,
    TextInput,
    Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

interface SettingsData {
    inviteCodeRequired: boolean;
    openaiKeySet: boolean;
    openaiKeyPreview: string | null;
    openaiModel: string;
}

export default function SettingsPage() {
    const adminFetch = useAdminFetch();
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingInvite, setSavingInvite] = useState(false);
    const [newApiKey, setNewApiKey] = useState("");
    const [savingKey, setSavingKey] = useState(false);
    const [savingModel, setSavingModel] = useState(false);

    const loadSettings = useCallback(async () => {
        const res = await adminFetch("/api/admin/settings");
        const d = await res.json();
        if (d.ok) setSettings(d.data as SettingsData);
        setLoading(false);
    }, [adminFetch]);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    async function toggleInviteCode() {
        if (!settings) return;
        setSavingInvite(true);
        const res = await adminFetch("/api/admin/settings", {
            method: "PATCH",
            body: JSON.stringify({ inviteCodeRequired: !settings.inviteCodeRequired }),
        });
        const data = await res.json();
        setSavingInvite(false);
        if (data.ok) {
            setSettings(data.data as SettingsData);
            notifications.show({ message: "Setting saved", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function saveApiKey() {
        if (!newApiKey.trim()) return;
        setSavingKey(true);
        const res = await adminFetch("/api/admin/settings", {
            method: "PATCH",
            body: JSON.stringify({ openaiApiKey: newApiKey }),
        });
        const data = await res.json();
        setSavingKey(false);
        if (data.ok) {
            setSettings(data.data as SettingsData);
            setNewApiKey("");
            notifications.show({ message: "API key saved", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    async function saveModel(model: string | null) {
        if (!model) return;
        setSavingModel(true);
        const res = await adminFetch("/api/admin/settings", {
            method: "PATCH",
            body: JSON.stringify({ openaiModel: model }),
        });
        const data = await res.json();
        setSavingModel(false);
        if (data.ok) {
            setSettings(data.data as SettingsData);
            notifications.show({ message: "Model saved", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    if (loading) return <Center py="xl"><Loader /></Center>;
    if (!settings) return null;

    return (
        <Stack gap="md">
            <Title order={3}>Settings</Title>

            <Paper withBorder p="md">
                <Stack gap={4}>
                    <Switch
                        label="Require invitation code for registration"
                        checked={settings.inviteCodeRequired}
                        onChange={() => void toggleInviteCode()}
                        disabled={savingInvite}
                    />
                    <Text size="xs" c="dimmed">
                        When enabled, new users must provide a valid invitation code to register.
                    </Text>
                </Stack>
            </Paper>

            <Paper withBorder p="md">
                <Stack gap="sm">
                    <Group justify="space-between" align="center">
                        <Text fw={500}>OpenAI Integration</Text>
                        {settings.openaiKeySet ? (
                            <Badge color="green" size="sm">Key configured</Badge>
                        ) : (
                            <Badge color="red" size="sm">No key set</Badge>
                        )}
                    </Group>

                    <Divider />

                    {settings.openaiKeyPreview && (
                        <TextInput
                            label="Current key"
                            value={settings.openaiKeyPreview}
                            readOnly
                            size="sm"
                            styles={{ input: { fontFamily: "monospace", color: "var(--mantine-color-dimmed)" } }}
                        />
                    )}

                    <Group align="flex-end" gap="xs">
                        <PasswordInput
                            label={settings.openaiKeySet ? "Update API key" : "API key"}
                            placeholder="sk-..."
                            value={newApiKey}
                            onChange={(e) => setNewApiKey(e.currentTarget.value)}
                            style={{ flex: 1 }}
                            size="sm"
                        />
                        <Button
                            size="sm"
                            onClick={() => void saveApiKey()}
                            loading={savingKey}
                            disabled={!newApiKey.trim()}
                        >
                            Save key
                        </Button>
                    </Group>

                    <Select
                        label="Model"
                        description="Affects quality and cost of AI analysis"
                        value={settings.openaiModel}
                        onChange={(v) => void saveModel(v)}
                        disabled={savingModel}
                        size="sm"
                        data={[
                            { value: "gpt-4o-mini", label: "gpt-4o-mini — fast, low cost (recommended)" },
                            { value: "gpt-4o", label: "gpt-4o — best quality, higher cost" },
                        ]}
                    />
                </Stack>
            </Paper>
        </Stack>
    );
}
