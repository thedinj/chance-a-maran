"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Center } from "@mantine/core";
import { useAdminSession } from "@/lib/admin/useAdminSession";

export default function AdminLoginPage() {
    const { login } = useAdminSession();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login(email, password);
            router.replace("/admin/cards");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Center h="100vh">
            <Paper withBorder p="xl" w={360}>
                <form onSubmit={(e) => void handleSubmit(e)}>
                    <Stack gap="md">
                        <Title order={3}>Chance Admin</Title>
                        <TextInput
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.currentTarget.value)}
                            required
                            autoFocus
                        />
                        <PasswordInput
                            label="Password"
                            value={password}
                            onChange={(e) => setPassword(e.currentTarget.value)}
                            required
                        />
                        {error && <Text c="red" size="sm">{error}</Text>}
                        <Button type="submit" loading={loading} fullWidth>
                            Sign in
                        </Button>
                    </Stack>
                </form>
            </Paper>
        </Center>
    );
}
