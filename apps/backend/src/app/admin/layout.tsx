"use client";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MantineProvider, AppShell, NavLink, Stack, Text, Group, Loader, Center } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import AdminSessionProvider from "@/lib/admin/AdminSessionProvider";
import { useAdminSession } from "@/lib/admin/useAdminSession";

const NAV_ITEMS = [
    { href: "/admin/cards", label: "Cards" },
    { href: "/admin/games", label: "Games" },
    { href: "/admin/requirement-elements", label: "Requirements" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/invitation-codes", label: "Invitation Codes" },
    { href: "/admin/settings", label: "Settings" },
];

function AdminShell({ children }: { children: React.ReactNode }) {
    const { user, isLoading, logout } = useAdminSession();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !user && pathname !== "/admin/login") {
            router.replace("/admin/login");
        }
    }, [isLoading, user, pathname, router]);

    if (isLoading) {
        return (
            <Center h="100vh">
                <Loader />
            </Center>
        );
    }

    if (!user) return null;

    return (
        <AppShell navbar={{ width: 220, breakpoint: "sm" }} padding="md">
            <AppShell.Navbar p="xs">
                <Stack gap={4} style={{ flex: 1 }}>
                    <Text fw={700} size="sm" px="xs" py="sm" c="dimmed" style={{ letterSpacing: "0.1em" }}>
                        CHANCE ADMIN
                    </Text>
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.href}
                            label={item.label}
                            active={pathname === item.href || pathname?.startsWith(item.href + "/")}
                            onClick={() => router.push(item.href)}
                        />
                    ))}
                </Stack>
                <Group px="xs" py="sm">
                    <Text size="xs" c="dimmed" style={{ flex: 1 }} truncate>
                        {user.email}
                    </Text>
                    <Text
                        size="xs"
                        c="red"
                        style={{ cursor: "pointer" }}
                        onClick={() => void logout().then(() => router.replace("/admin/login"))}
                    >
                        Sign out
                    </Text>
                </Group>
            </AppShell.Navbar>
            <AppShell.Main>{children}</AppShell.Main>
        </AppShell>
    );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (pathname === "/admin/login") return <>{children}</>;
    return <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <MantineProvider defaultColorScheme="dark">
            <ModalsProvider>
                <Notifications />
                <AdminSessionProvider>
                    <AdminLayoutInner>{children}</AdminLayoutInner>
                </AdminSessionProvider>
            </ModalsProvider>
        </MantineProvider>
    );
}
