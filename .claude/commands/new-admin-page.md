You are creating a new admin portal page for the Chance app. Before writing any code, read the most similar existing admin page in `apps/backend/src/app/admin/` to internalize the exact Mantine pattern.

## What to build

The user's message (or `$ARGUMENTS`) describes the new admin section. Determine:
- **Entity name** (e.g. "rewards", "campaigns")
- **Operations needed**: list / create / edit / toggle-active / delete
- **API endpoints** this page will call (create them with `/new-api-route` if they don't exist)
- **Drawer vs Modal**: use a **Drawer** (right panel) for editing a selected item, a **Modal** for create / confirm-delete

---

## File to create

`apps/backend/src/app/admin/<entity>/page.tsx`

---

## Exact admin page template

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Title,
    Table,
    Badge,
    Switch,
    Button,
    TextInput,
    Stack,
    Group,
    Modal,
    Drawer,
    ScrollArea,
    Text,
    Loader,
    Center,
    ActionIcon,
    Tooltip,
    Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";

// Mirror the shape returned by your API — no import from @chance/core needed here,
// but keep it consistent with the actual API response.
interface AdminWidget {
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
}

export default function WidgetsPage() {
    const adminFetch = useAdminFetch();
    const [items, setItems] = useState<AdminWidget[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Create modal
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    // Edit drawer
    const [selected, setSelected] = useState<AdminWidget | null>(null);
    const [editName, setEditName] = useState("");
    const [saving, setSaving] = useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<AdminWidget | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── Load ────────────────────────────────────────────────────────────────
    useEffect(() => {
        setLoading(true);
        adminFetch("/api/admin/widgets")
            .then((r) => r.json())
            .then((d) => {
                if (d.ok) setItems(d.data as AdminWidget[]);
                setLoading(false);
            });
    }, [adminFetch]);

    // ── Toggle active ───────────────────────────────────────────────────────
    function toggleActive(item: AdminWidget) {
        startTransition(async () => {
            const res = await adminFetch(`/api/admin/widgets/${item.id}`, {
                method: "PATCH",
                body: JSON.stringify({ active: !item.active }),
            });
            const data = await res.json();
            if (data.ok) {
                setItems((prev) => prev.map((x) => (x.id === item.id ? (data.data as AdminWidget) : x)));
                if (selected?.id === item.id) setSelected(data.data as AdminWidget);
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    // ── Edit ────────────────────────────────────────────────────────────────
    function openDrawer(item: AdminWidget) {
        setSelected(item);
        setEditName(item.name);
    }

    async function saveEdit() {
        if (!selected || !editName.trim()) return;
        setSaving(true);
        const res = await adminFetch(`/api/admin/widgets/${selected.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: editName.trim() }),
        });
        const data = await res.json();
        setSaving(false);
        if (data.ok) {
            setItems((prev) => prev.map((x) => (x.id === selected.id ? (data.data as AdminWidget) : x)));
            setSelected(data.data as AdminWidget);
            notifications.show({ message: "Saved", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    // ── Create ──────────────────────────────────────────────────────────────
    async function createItem() {
        if (!newName.trim()) return;
        setCreating(true);
        const res = await adminFetch("/api/admin/widgets", {
            method: "POST",
            body: JSON.stringify({ name: newName.trim() }),
        });
        const data = await res.json();
        setCreating(false);
        if (data.ok) {
            setItems((prev) => [...prev, data.data as AdminWidget]);
            setNewName("");
            setCreateOpen(false);
            notifications.show({ message: "Created", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    // ── Delete ──────────────────────────────────────────────────────────────
    async function executeDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        const res = await adminFetch(`/api/admin/widgets/${deleteTarget.id}`, { method: "DELETE" });
        const data = await res.json();
        setDeleting(false);
        if (data.ok) {
            setItems((prev) => prev.filter((x) => x.id !== deleteTarget.id));
            if (selected?.id === deleteTarget.id) setSelected(null);
            setDeleteTarget(null);
            notifications.show({ message: "Deleted", color: "green" });
        } else {
            notifications.show({ message: data.error?.message ?? "Error", color: "red" });
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <>
            <Stack gap="md">
                <Group justify="space-between">
                    <Title order={3}>Widgets</Title>
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                        New Widget
                    </Button>
                </Group>

                {loading ? (
                    <Center py="xl">
                        <Loader />
                    </Center>
                ) : (
                    <Table striped highlightOnHover withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Name</Table.Th>
                                <Table.Th>Active</Table.Th>
                                <Table.Th />
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {items.map((item) => (
                                <Table.Tr
                                    key={item.id}
                                    style={{ cursor: "pointer" }}
                                    bg={selected?.id === item.id ? "var(--mantine-color-dark-6)" : undefined}
                                    onClick={() => openDrawer(item)}
                                >
                                    <Table.Td>{item.name}</Table.Td>
                                    <Table.Td onClick={(e) => e.stopPropagation()}>
                                        <Switch
                                            checked={item.active}
                                            size="xs"
                                            disabled={isPending}
                                            onChange={() => toggleActive(item)}
                                        />
                                    </Table.Td>
                                    <Table.Td onClick={(e) => e.stopPropagation()}>
                                        <Tooltip label="Delete">
                                            <ActionIcon
                                                variant="subtle"
                                                size="sm"
                                                color="red"
                                                onClick={() => setDeleteTarget(item)}
                                            >
                                                🗑
                                            </ActionIcon>
                                        </Tooltip>
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
                title={selected?.name ?? "Widget"}
                position="right"
                size="sm"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {selected && (
                    <Stack gap="md">
                        <Text size="xs" c="dimmed">
                            Created {new Date(selected.createdAt).toLocaleDateString()}
                        </Text>
                        <Divider />
                        <TextInput
                            label="Name"
                            value={editName}
                            onChange={(e) => setEditName(e.currentTarget.value)}
                        />
                        <Switch
                            label="Active"
                            checked={selected.active}
                            disabled={isPending}
                            onChange={() => toggleActive(selected)}
                        />
                        <Button onClick={() => void saveEdit()} loading={saving} disabled={!editName.trim()}>
                            Save changes
                        </Button>
                    </Stack>
                )}
            </Drawer>

            {/* Create modal */}
            <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="New Widget">
                <Stack gap="md">
                    <TextInput
                        label="Name"
                        placeholder="Widget name"
                        value={newName}
                        onChange={(e) => setNewName(e.currentTarget.value)}
                        autoFocus
                    />
                    <Button onClick={() => void createItem()} loading={creating} disabled={!newName.trim()} fullWidth>
                        Create
                    </Button>
                </Stack>
            </Modal>

            {/* Delete confirmation */}
            <Modal
                opened={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Delete Widget"
            >
                <Stack gap="md">
                    <Text size="sm">
                        Permanently delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.
                    </Text>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setDeleteTarget(null)}>
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
```

---

## Register in the admin nav

Add an entry to the `NAV_ITEMS` array in `apps/backend/src/app/admin/layout.tsx`:

```ts
{ href: "/admin/widgets", label: "Widgets" },
```

Place it in logical order with the existing items (alphabetical within their tier, or grouped by domain).

---

## Rules

- `"use client"` directive — always first.
- `useAdminFetch()` — all API calls go through this hook; it attaches the admin session cookie automatically.
- `useAdminSession()` — only needed if you render the current admin user's info on the page; most pages don't need it.
- Row click opens the Drawer; action icons (edit/delete) stop propagation.
- `onClick={(e) => e.stopPropagation()}` on Switch and action icon cells so clicking them doesn't also open the Drawer.
- Update local state after mutations — do not refetch the whole list.
- `notifications.show({ message: "...", color: "green" })` for success; `color: "red"` for errors.
- Omit operations that don't apply (no create = no createOpen state, no Modal).
- Sort lists alphabetically on load and after create/update.
- If the entity has a `Badge` (e.g. status), use `<Badge size="xs" color="...">`.
