"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
    Title,
    Table,
    Badge,
    Switch,
    TextInput,
    Group,
    Stack,
    Text,
    Drawer,
    Image,
    Button,
    Divider,
    Select,
    ScrollArea,
    Loader,
    Center,
    Textarea,
    SegmentedControl,
    MultiSelect,
    Tooltip,
    Slider,
    Box,
    Modal,
    Checkbox,
    Paper,
    Alert,
    LoadingOverlay,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSessionStorage } from "@mantine/hooks";
import { useInView } from "react-intersection-observer";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";
import type { Card, CardVersion, CardAnalysisResult } from "@chance/core";
import { BulkAnalysisModal } from "./BulkAnalysisModal";
import { LevelPicker } from "./LevelPicker";
import { DRINKING_LEVELS, SPICE_LEVELS, CARD_IMAGE_ASPECT_RATIO } from "@chance/core";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FilterState = {
    search: string;
    active: string;
    isGlobal: string;
    pendingGlobal: string;
    gameId: string;
    drinkingLevel: string;
    spiceLevel: string;
};

interface GameOption {
    id: string;
    name: string;
}
interface ElementOption {
    id: string;
    title: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString();
}

function LevelBadge({ label, value, tooltip }: { label: string; value: number; tooltip: string }) {
    if (value === 0) return null;
    const colors = ["gray", "yellow", "orange", "red"] as const;
    return (
        <Tooltip label={tooltip} withArrow>
            <Badge size="xs" color={colors[value]}>
                {label} {value}
            </Badge>
        </Tooltip>
    );
}

// ─── Lazy thumbnail ────────────────────────────────────────────────────────────

function LazyThumbnail({ imageId, apiBaseUrl }: { imageId: string; apiBaseUrl: string }) {
    const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px" });
    return (
        <div
            ref={ref}
            style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                borderRadius: 3,
                overflow: "hidden",
                background: "var(--mantine-color-dark-5)",
            }}
        >
            {inView && (
                <img
                    src={`${apiBaseUrl}/api/media/${imageId}`}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
            )}
        </div>
    );
}

// ─── Card Detail Drawer ────────────────────────────────────────────────────────

interface UserOption {
    id: string;
    displayName: string;
    email: string;
}

function CardDrawer({
    card,
    onClose,
    onChanged,
    onAnalyzed,
    onAccepted,
    onDismissed,
    onNoChange,
    apiBaseUrl,
}: {
    card: Card;
    onClose: () => void;
    onChanged: (updated: Card) => void;
    onAnalyzed: (versionIds: string[]) => void;
    onAccepted: (versionId: string) => void;
    onDismissed: (versionId: string) => void;
    onNoChange: (versionId: string) => void;
    apiBaseUrl: string;
}) {
    const adminFetch = useAdminFetch();
    const [isPending, startTransition] = useTransition();
    const [versions, setVersions] = useState<CardVersion[]>([]);
    const [editing, setEditing] = useState(false);
    const [transferring, setTransferring] = useState(false);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [newOwnerUserId, setNewOwnerUserId] = useState<string | null>(null);
    const [transferSaving, setTransferSaving] = useState(false);

    // Edit form state
    const [games, setGames] = useState<GameOption[]>([]);
    const [elements, setElements] = useState<ElementOption[]>([]);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editHidden, setEditHidden] = useState("");
    const [editDrinking, setEditDrinking] = useState("0");
    const [editSpice, setEditSpice] = useState("0");
    const [editGameChanger, setEditGameChanger] = useState(false);
    const [editCardType, setEditCardType] = useState<string>("standard");
    const [editGameTags, setEditGameTags] = useState<string[]>([]);
    const [editRequirements, setEditRequirements] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const imgDragStartY = useRef(0);
    const imgDragStartOffset = useRef(0.5);

    // Analysis modal state
    const [analysisOpen, setAnalysisOpen] = useState(false);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<CardAnalysisResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analysisApplying, setAnalysisApplying] = useState(false);
    const [checkedFields, setCheckedFields] = useState<Set<string>>(new Set());
    const [overrideFields, setOverrideFields] = useState<Map<string, number>>(new Map());

    const cv = card.currentVersion;

    const [editImageYOffset, setEditImageYOffset] = useState(cv.imageYOffset ?? 0.5);

    useEffect(() => {
        adminFetch(`/api/cards/${card.id}/versions`)
            .then((r) => r.json())
            .then((d) => {
                if (d.ok) setVersions(d.data as CardVersion[]);
            });
    }, [card.id, adminFetch]);

    const loadEditData = useCallback(async () => {
        const [gamesRes, elementsRes] = await Promise.all([
            adminFetch("/api/admin/games").then((r) => r.json()),
            adminFetch("/api/admin/requirement-elements").then((r) => r.json()),
        ]);
        if (gamesRes.ok) setGames(gamesRes.data as GameOption[]);
        if (elementsRes.ok) setElements(elementsRes.data as ElementOption[]);
    }, [adminFetch]);

    function startEdit() {
        setEditTitle(cv.title);
        setEditDescription(cv.description);
        setEditHidden(cv.hiddenInstructions ?? "");
        setEditDrinking(String(cv.drinkingLevel));
        setEditSpice(String(cv.spiceLevel));
        setEditGameChanger(cv.isGameChanger);
        setEditCardType(card.cardType);
        setEditGameTags(cv.gameTags.map((g) => g.id));
        setEditRequirements(cv.requirements.map((r) => r.id));
        setEditImageYOffset(cv.imageYOffset ?? 0.5);
        void loadEditData();
        setEditing(true);
    }

    function startTransfer() {
        setNewOwnerUserId(null);
        if (users.length === 0) {
            adminFetch("/api/admin/users")
                .then((r) => r.json())
                .then((d) => {
                    if (d.ok) setUsers(d.data as UserOption[]);
                });
        }
        setTransferring(true);
    }

    async function saveTransfer() {
        if (!newOwnerUserId) return;
        setTransferSaving(true);
        try {
            const res = await adminFetch(`/api/admin/cards/${card.id}/transfer-owner`, {
                method: "POST",
                body: JSON.stringify({ newOwnerUserId }),
            });
            const data = await res.json();
            if (data.ok) {
                onChanged(data.data as Card);
                setTransferring(false);
                notifications.show({ message: "Ownership transferred", color: "green" });
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        } finally {
            setTransferSaving(false);
        }
    }

    function action(url: string, method = "POST") {
        startTransition(async () => {
            const res = await adminFetch(url, { method });
            const data = await res.json();
            if (data.ok) {
                onChanged(data.data as Card);
                notifications.show({ message: "Updated", color: "green" });
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    async function saveEdit() {
        setSaving(true);
        try {
            // Change cardType if needed (separate admin endpoint)
            if (editCardType !== card.cardType) {
                const typeRes = await adminFetch(`/api/admin/cards/${card.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ cardType: editCardType }),
                });
                const typeData = await typeRes.json();
                if (!typeData.ok) {
                    notifications.show({
                        message: typeData.error?.message ?? "Error",
                        color: "red",
                    });
                    setSaving(false);
                    return;
                }
            }

            // Update card content (creates new version)
            const contentRes = await adminFetch(`/api/cards/${card.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    title: editTitle,
                    description: editDescription,
                    hiddenInstructions: editHidden || null,
                    imageId: cv.imageId ?? null,
                    imageYOffset: editImageYOffset,
                    drinkingLevel: Number(editDrinking),
                    spiceLevel: Number(editSpice),
                    isGameChanger: editCardType === "reparations" ? false : editGameChanger,
                    cardType: editCardType,
                    gameTags: editGameTags,
                    requirementIds: editRequirements,
                }),
            });
            const contentData = await contentRes.json();
            if (contentData.ok) {
                onChanged(contentData.data as Card);
                setEditing(false);
                notifications.show({ message: "Card updated", color: "green" });
            } else {
                notifications.show({
                    message: contentData.error?.message ?? "Error",
                    color: "red",
                });
            }
        } finally {
            setSaving(false);
        }
    }

    async function openAnalysis() {
        setAnalysisResult(null);
        setAnalysisError(null);
        setCheckedFields(new Set());
        setOverrideFields(new Map());
        setAnalysisOpen(true);
        setAnalysisLoading(true);
        try {
            const res = await adminFetch("/api/admin/cards/analyze", {
                method: "POST",
                body: JSON.stringify({ cardIds: [card.id] }),
            });
            const data = await res.json();
            if (data.ok) {
                const response = data.data as { results: CardAnalysisResult[] };
                const result = response.results[0] ?? null;
                setAnalysisResult(result);
                onAnalyzed([card.id]);
                if (!result.changed) {
                    onNoChange(card.id);
                }
                // Pre-check all changed fields
                if (result.changed) {
                    const changed = new Set<string>();
                    if (result.current.spiceLevel !== result.suggested.spiceLevel)
                        changed.add("spiceLevel");
                    if (result.current.drinkingLevel !== result.suggested.drinkingLevel)
                        changed.add("drinkingLevel");
                    const sortedCG = [...result.current.gameTagIds].sort().join(",");
                    const sortedSG = [...result.suggested.gameTagIds].sort().join(",");
                    if (sortedCG !== sortedSG) changed.add("gameTagIds");
                    const sortedCE = [...result.current.requirementElementIds].sort().join(",");
                    const sortedSE = [...result.suggested.requirementElementIds].sort().join(",");
                    if (sortedCE !== sortedSE) changed.add("requirementElementIds");
                    setCheckedFields(changed);
                }
            } else {
                setAnalysisError(data.error?.message ?? "Analysis failed");
            }
        } catch {
            setAnalysisError("Network error — could not reach the server");
        } finally {
            setAnalysisLoading(false);
        }
    }

    async function applyAnalysis() {
        if (!analysisResult) return;
        setAnalysisApplying(true);
        try {
            const suggested = analysisResult.suggested;
            const effectiveSpice = overrideFields.get("spiceLevel") ?? suggested.spiceLevel;
            const effectiveDrinking =
                overrideFields.get("drinkingLevel") ?? suggested.drinkingLevel;
            const payload = {
                title: cv.title,
                description: cv.description,
                hiddenInstructions: cv.hiddenInstructions ?? null,
                imageId: cv.imageId ?? null,
                imageYOffset: cv.imageYOffset ?? 0.5,
                drinkingLevel: checkedFields.has("drinkingLevel")
                    ? effectiveDrinking
                    : cv.drinkingLevel,
                spiceLevel: checkedFields.has("spiceLevel") ? effectiveSpice : cv.spiceLevel,
                isGameChanger: cv.isGameChanger,
                cardType: card.cardType,
                gameTags: checkedFields.has("gameTagIds")
                    ? suggested.gameTagIds
                    : cv.gameTags.map((g) => g.id),
                requirementIds: checkedFields.has("requirementElementIds")
                    ? suggested.requirementElementIds
                    : cv.requirements.map((r) => r.id),
            };
            const res = await adminFetch(`/api/cards/${card.id}`, {
                method: "PATCH",
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.ok) {
                onChanged(data.data as Card);
                onAccepted(card.id);
                setAnalysisOpen(false);
                notifications.show({ message: "AI recommendations applied", color: "teal" });
            } else {
                notifications.show({
                    message: data.error?.message ?? "Apply failed",
                    color: "red",
                });
            }
        } finally {
            setAnalysisApplying(false);
        }
    }

    if (transferring) {
        return (
            <Stack gap="md">
                <Text size="sm" fw={500}>
                    Transfer ownership of &ldquo;{cv.title}&rdquo;
                </Text>
                <Text size="xs" c="dimmed">
                    Current owner: {card.ownerDisplayName}
                </Text>
                <Select
                    label="New owner"
                    placeholder="Search users…"
                    data={users.map((u) => ({
                        value: u.id,
                        label: `${u.displayName} (${u.email})`,
                    }))}
                    value={newOwnerUserId}
                    onChange={setNewOwnerUserId}
                    searchable
                    clearable
                />
                <Group>
                    <Button
                        onClick={() => void saveTransfer()}
                        loading={transferSaving}
                        disabled={!newOwnerUserId || newOwnerUserId === card.authorUserId}
                        color="orange"
                    >
                        Transfer
                    </Button>
                    <Button variant="subtle" color="gray" onClick={() => setTransferring(false)}>
                        Cancel
                    </Button>
                </Group>
            </Stack>
        );
    }

    if (editing) {
        return (
            <Stack gap="md">
                <Select
                    label="Card type"
                    data={[
                        { value: "standard", label: "Standard" },
                        { value: "reparations", label: "Reparations" },
                    ]}
                    value={editCardType}
                    onChange={(v) => setEditCardType(v ?? "standard")}
                />
                <TextInput
                    label="Title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.currentTarget.value)}
                />
                <Textarea
                    label="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.currentTarget.value)}
                    autosize
                    minRows={3}
                />
                <Textarea
                    label="Hidden instructions"
                    description="Revealed only to the drawing player initially"
                    value={editHidden}
                    onChange={(e) => setEditHidden(e.currentTarget.value)}
                    autosize
                    minRows={2}
                />
                <Stack gap={4}>
                    <Text size="sm" fw={500}>
                        Drinking level
                    </Text>
                    <SegmentedControl
                        value={editDrinking}
                        onChange={setEditDrinking}
                        data={DRINKING_LEVELS.levels.map((l) => ({
                            value: String(l.value),
                            label: l.emoji || l.label,
                        }))}
                    />
                </Stack>
                <Stack gap={4}>
                    <Text size="sm" fw={500}>
                        Spice level
                    </Text>
                    <SegmentedControl
                        value={editSpice}
                        onChange={setEditSpice}
                        data={SPICE_LEVELS.levels.map((l) => ({
                            value: String(l.value),
                            label: l.emoji || l.label,
                        }))}
                    />
                </Stack>
                {editCardType !== "reparations" && (
                    <Switch
                        label="Game changer"
                        checked={editGameChanger}
                        onChange={(e) => setEditGameChanger(e.currentTarget.checked)}
                    />
                )}
                <MultiSelect
                    label="Game tags"
                    data={games.map((g) => ({ value: g.id, label: g.name }))}
                    value={editGameTags}
                    onChange={setEditGameTags}
                    searchable
                    clearable
                />
                <MultiSelect
                    label="Requirements"
                    data={elements.map((e) => ({ value: e.id, label: e.title }))}
                    value={editRequirements}
                    onChange={setEditRequirements}
                    searchable
                    clearable
                />
                {cv.imageId && (
                    <Stack gap={4}>
                        <Text size="sm" fw={500}>
                            Image position
                        </Text>
                        <Box
                            style={{
                                width: "100%",
                                aspectRatio: `${CARD_IMAGE_ASPECT_RATIO.width} / ${CARD_IMAGE_ASPECT_RATIO.height}`,
                                overflow: "hidden",
                                borderRadius: 4,
                                cursor: "ns-resize",
                                touchAction: "none",
                                userSelect: "none",
                            }}
                            onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                imgDragStartY.current = e.clientY;
                                imgDragStartOffset.current = editImageYOffset;
                            }}
                            onPointerMove={(e) => {
                                if (e.buttons === 0) return;
                                const containerH = e.currentTarget.getBoundingClientRect().height;
                                const dy = e.clientY - imgDragStartY.current;
                                const delta = dy / containerH;
                                const next = Math.min(
                                    1,
                                    Math.max(0, imgDragStartOffset.current + delta)
                                );
                                setEditImageYOffset(next);
                            }}
                        >
                            <img
                                src={`${apiBaseUrl}/api/media/${cv.imageId}`}
                                alt={cv.title}
                                style={
                                    {
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        objectPosition: `center ${editImageYOffset * 100}%`,
                                        display: "block",
                                        pointerEvents: "none",
                                        draggable: false,
                                    } as React.CSSProperties
                                }
                            />
                        </Box>
                        <Slider
                            min={0}
                            max={1}
                            step={0.01}
                            value={editImageYOffset}
                            onChange={setEditImageYOffset}
                            marks={[
                                { value: 0, label: "Top" },
                                { value: 0.5, label: "Center" },
                                { value: 1, label: "Bottom" },
                            ]}
                        />
                        <Text size="xs" c="dimmed" mt={4}>
                            Drag image or use slider to set crop position.
                        </Text>
                    </Stack>
                )}
                <Group>
                    <Button
                        onClick={() => void saveEdit()}
                        loading={saving}
                        disabled={!editTitle.trim() || !editDescription.trim()}
                    >
                        Save
                    </Button>
                    <Button variant="subtle" color="gray" onClick={() => setEditing(false)}>
                        Cancel
                    </Button>
                </Group>
            </Stack>
        );
    }

    const drinkingLevelInfo = DRINKING_LEVELS.levels[cv.drinkingLevel];
    const spiceLevelInfo = SPICE_LEVELS.levels[cv.spiceLevel];

    return (
        <>
            {/* ── Analysis Modal ─────────────────────────────────────── */}
            <Modal
                opened={analysisOpen}
                onClose={() => {
                    if (analysisLoading || analysisApplying) return;
                    if (analysisResult?.changed) onDismissed(card.id);
                    setAnalysisOpen(false);
                }}
                title={analysisResult?.changed ? `AI Recommendations` : "AI Analysis"}
                size="md"
            >
                <Box pos="relative">
                    <LoadingOverlay
                        visible={analysisLoading || analysisApplying}
                        overlayProps={{ blur: 2 }}
                    />

                    {analysisError && (
                        <Alert color="red" mb="md">
                            {analysisError}
                        </Alert>
                    )}

                    {analysisResult?.error && (
                        <Alert color="red" mb="md">
                            {analysisResult.error}
                        </Alert>
                    )}

                    {analysisResult && !analysisResult.error && (
                        <>
                            <Paper withBorder p="sm" mb="md">
                                <Text size="xs" c="dimmed" mb={4}>
                                    AI justification
                                </Text>
                                <Text size="sm">{analysisResult.justification}</Text>
                            </Paper>

                            {analysisResult.changed && (
                                <Text size="xs" c="dimmed" mb="sm">
                                    Select the recommendations you want to apply to &ldquo;
                                    {analysisResult.title}&rdquo;.
                                </Text>
                            )}

                            {!analysisResult.changed && (
                                <Text size="xs" c="dimmed" mb="sm">
                                    No changes recommended — all fields look correct. Current values
                                    shown below.
                                </Text>
                            )}

                            <Stack gap="xs">
                                {/* Spice level */}
                                {(() => {
                                    const spiceChanged =
                                        analysisResult.current.spiceLevel !==
                                        analysisResult.suggested.spiceLevel;
                                    const spiceSelected =
                                        overrideFields.get("spiceLevel") ??
                                        (spiceChanged
                                            ? analysisResult.suggested.spiceLevel
                                            : analysisResult.current.spiceLevel);
                                    return (
                                        <Paper
                                            withBorder
                                            p="sm"
                                            style={{
                                                opacity:
                                                    spiceChanged || checkedFields.has("spiceLevel")
                                                        ? 1
                                                        : 0.45,
                                            }}
                                        >
                                            <Stack gap={6}>
                                                <Checkbox
                                                    checked={checkedFields.has("spiceLevel")}
                                                    onChange={(e) => {
                                                        const next = new Set(checkedFields);
                                                        if (e.currentTarget.checked)
                                                            next.add("spiceLevel");
                                                        else next.delete("spiceLevel");
                                                        setCheckedFields(next);
                                                    }}
                                                    label={
                                                        <Text size="sm" fw={500}>
                                                            Spice level
                                                        </Text>
                                                    }
                                                />
                                                <LevelPicker
                                                    levels={SPICE_LEVELS.levels}
                                                    selected={spiceSelected}
                                                    suggested={analysisResult.suggested.spiceLevel}
                                                    current={analysisResult.current.spiceLevel}
                                                    color="orange"
                                                    onChange={(v) => {
                                                        const next = new Map(overrideFields);
                                                        next.set("spiceLevel", v);
                                                        setOverrideFields(next);
                                                        if (!spiceChanged) {
                                                            const cf = new Set(checkedFields);
                                                            if (
                                                                v !==
                                                                analysisResult.current.spiceLevel
                                                            )
                                                                cf.add("spiceLevel");
                                                            else cf.delete("spiceLevel");
                                                            setCheckedFields(cf);
                                                        }
                                                    }}
                                                />
                                            </Stack>
                                        </Paper>
                                    );
                                })()}

                                {/* Drinking level */}
                                {(() => {
                                    const drinkingChanged =
                                        analysisResult.current.drinkingLevel !==
                                        analysisResult.suggested.drinkingLevel;
                                    const drinkingSelected =
                                        overrideFields.get("drinkingLevel") ??
                                        (drinkingChanged
                                            ? analysisResult.suggested.drinkingLevel
                                            : analysisResult.current.drinkingLevel);
                                    return (
                                        <Paper
                                            withBorder
                                            p="sm"
                                            style={{
                                                opacity:
                                                    drinkingChanged ||
                                                    checkedFields.has("drinkingLevel")
                                                        ? 1
                                                        : 0.45,
                                            }}
                                        >
                                            <Stack gap={6}>
                                                <Checkbox
                                                    checked={checkedFields.has("drinkingLevel")}
                                                    onChange={(e) => {
                                                        const next = new Set(checkedFields);
                                                        if (e.currentTarget.checked)
                                                            next.add("drinkingLevel");
                                                        else next.delete("drinkingLevel");
                                                        setCheckedFields(next);
                                                    }}
                                                    label={
                                                        <Text size="sm" fw={500}>
                                                            Drinking level
                                                        </Text>
                                                    }
                                                />
                                                <LevelPicker
                                                    levels={DRINKING_LEVELS.levels}
                                                    selected={drinkingSelected}
                                                    suggested={
                                                        analysisResult.suggested.drinkingLevel
                                                    }
                                                    current={analysisResult.current.drinkingLevel}
                                                    color="blue"
                                                    onChange={(v) => {
                                                        const next = new Map(overrideFields);
                                                        next.set("drinkingLevel", v);
                                                        setOverrideFields(next);
                                                        if (!drinkingChanged) {
                                                            const cf = new Set(checkedFields);
                                                            if (
                                                                v !==
                                                                analysisResult.current.drinkingLevel
                                                            )
                                                                cf.add("drinkingLevel");
                                                            else cf.delete("drinkingLevel");
                                                            setCheckedFields(cf);
                                                        }
                                                    }}
                                                />
                                            </Stack>
                                        </Paper>
                                    );
                                })()}

                                {/* Game tags */}
                                {[...analysisResult.current.gameTagIds].sort().join(",") !==
                                [...analysisResult.suggested.gameTagIds].sort().join(",") ? (
                                    <Paper withBorder p="sm">
                                        <Checkbox
                                            checked={checkedFields.has("gameTagIds")}
                                            onChange={(e) => {
                                                const next = new Set(checkedFields);
                                                if (e.currentTarget.checked) next.add("gameTagIds");
                                                else next.delete("gameTagIds");
                                                setCheckedFields(next);
                                            }}
                                            label={
                                                <Stack gap={4}>
                                                    <Text size="sm" fw={500}>
                                                        Game tags
                                                    </Text>
                                                    <Group gap={4}>
                                                        {analysisResult.current.gameTagIds
                                                            .length === 0 ? (
                                                            <Text size="xs" c="dimmed">
                                                                none
                                                            </Text>
                                                        ) : (
                                                            analysisResult.current.gameTagIds.map(
                                                                (id) => (
                                                                    <Badge
                                                                        key={id}
                                                                        size="xs"
                                                                        color="gray"
                                                                        variant="outline"
                                                                    >
                                                                        {analysisResult.gameLookup[
                                                                            id
                                                                        ] ?? id}
                                                                    </Badge>
                                                                )
                                                            )
                                                        )}
                                                        <Text size="xs" c="dimmed">
                                                            →
                                                        </Text>
                                                        {analysisResult.suggested.gameTagIds
                                                            .length === 0 ? (
                                                            <Text size="xs" c="dimmed">
                                                                none
                                                            </Text>
                                                        ) : (
                                                            analysisResult.suggested.gameTagIds.map(
                                                                (id) => (
                                                                    <Badge
                                                                        key={id}
                                                                        size="xs"
                                                                        color="violet"
                                                                        variant="light"
                                                                    >
                                                                        {analysisResult.gameLookup[
                                                                            id
                                                                        ] ?? id}
                                                                    </Badge>
                                                                )
                                                            )
                                                        )}
                                                    </Group>
                                                </Stack>
                                            }
                                        />
                                    </Paper>
                                ) : (
                                    <Paper withBorder p="sm" style={{ opacity: 0.45 }}>
                                        <Group gap="xs" align="flex-start">
                                            <Text size="sm" c="dimmed" w={20} mt={2}>
                                                —
                                            </Text>
                                            <Stack gap={4}>
                                                <Text size="sm" fw={500} c="dimmed">
                                                    Game tags
                                                </Text>
                                                <Group gap={4}>
                                                    {analysisResult.current.gameTagIds.length ===
                                                    0 ? (
                                                        <Text size="xs" c="dimmed">
                                                            none
                                                        </Text>
                                                    ) : (
                                                        analysisResult.current.gameTagIds.map(
                                                            (id) => (
                                                                <Badge
                                                                    key={id}
                                                                    size="xs"
                                                                    color="gray"
                                                                    variant="outline"
                                                                >
                                                                    {analysisResult.gameLookup[
                                                                        id
                                                                    ] ?? id}
                                                                </Badge>
                                                            )
                                                        )
                                                    )}
                                                </Group>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                )}

                                {/* Requirements */}
                                {[...analysisResult.current.requirementElementIds]
                                    .sort()
                                    .join(",") !==
                                [...analysisResult.suggested.requirementElementIds]
                                    .sort()
                                    .join(",") ? (
                                    <Paper withBorder p="sm">
                                        <Checkbox
                                            checked={checkedFields.has("requirementElementIds")}
                                            onChange={(e) => {
                                                const next = new Set(checkedFields);
                                                if (e.currentTarget.checked)
                                                    next.add("requirementElementIds");
                                                else next.delete("requirementElementIds");
                                                setCheckedFields(next);
                                            }}
                                            label={
                                                <Stack gap={4}>
                                                    <Text size="sm" fw={500}>
                                                        Requirements
                                                    </Text>
                                                    <Group gap={4}>
                                                        {analysisResult.current
                                                            .requirementElementIds.length === 0 ? (
                                                            <Text size="xs" c="dimmed">
                                                                none
                                                            </Text>
                                                        ) : (
                                                            analysisResult.current.requirementElementIds.map(
                                                                (id) => (
                                                                    <Badge
                                                                        key={id}
                                                                        size="xs"
                                                                        color="gray"
                                                                        variant="outline"
                                                                    >
                                                                        {analysisResult
                                                                            .elementLookup[id] ??
                                                                            id}
                                                                    </Badge>
                                                                )
                                                            )
                                                        )}
                                                        <Text size="xs" c="dimmed">
                                                            →
                                                        </Text>
                                                        {analysisResult.suggested
                                                            .requirementElementIds.length === 0 ? (
                                                            <Text size="xs" c="dimmed">
                                                                none
                                                            </Text>
                                                        ) : (
                                                            analysisResult.suggested.requirementElementIds.map(
                                                                (id) => (
                                                                    <Badge
                                                                        key={id}
                                                                        size="xs"
                                                                        color="green"
                                                                        variant="light"
                                                                    >
                                                                        {analysisResult
                                                                            .elementLookup[id] ??
                                                                            id}
                                                                    </Badge>
                                                                )
                                                            )
                                                        )}
                                                    </Group>
                                                </Stack>
                                            }
                                        />
                                    </Paper>
                                ) : (
                                    <Paper withBorder p="sm" style={{ opacity: 0.45 }}>
                                        <Group gap="xs" align="flex-start">
                                            <Text size="sm" c="dimmed" w={20} mt={2}>
                                                —
                                            </Text>
                                            <Stack gap={4}>
                                                <Text size="sm" fw={500} c="dimmed">
                                                    Requirements
                                                </Text>
                                                <Group gap={4}>
                                                    {analysisResult.current.requirementElementIds
                                                        .length === 0 ? (
                                                        <Text size="xs" c="dimmed">
                                                            none
                                                        </Text>
                                                    ) : (
                                                        analysisResult.current.requirementElementIds.map(
                                                            (id) => (
                                                                <Badge
                                                                    key={id}
                                                                    size="xs"
                                                                    color="gray"
                                                                    variant="outline"
                                                                >
                                                                    {analysisResult.elementLookup[
                                                                        id
                                                                    ] ?? id}
                                                                </Badge>
                                                            )
                                                        )
                                                    )}
                                                </Group>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                )}
                            </Stack>

                            <Group justify="flex-end" mt="md">
                                <Button
                                    variant="subtle"
                                    color="gray"
                                    onClick={() => {
                                        if (analysisResult?.changed) onDismissed(card.id);
                                        setAnalysisOpen(false);
                                    }}
                                >
                                    {analysisResult.changed ? "Cancel" : "Close"}
                                </Button>
                                {analysisResult.changed && (
                                    <Button
                                        color="teal"
                                        onClick={() => void applyAnalysis()}
                                        loading={analysisApplying}
                                        disabled={checkedFields.size === 0}
                                    >
                                        Apply selected
                                    </Button>
                                )}
                            </Group>
                        </>
                    )}

                    {!analysisLoading && !analysisResult && !analysisError && (
                        <Center py="xl">
                            <Loader size="sm" />
                        </Center>
                    )}

                    {analysisError && (
                        <Group justify="flex-end" mt="md">
                            <Button
                                variant="subtle"
                                color="gray"
                                onClick={() => setAnalysisOpen(false)}
                            >
                                Close
                            </Button>
                        </Group>
                    )}
                </Box>
            </Modal>

            {/* ── Card View ──────────────────────────────────────────── */}
            <Stack gap="md">
                {cv.imageId && (
                    <Box
                        style={{
                            width: "100%",
                            aspectRatio: `${CARD_IMAGE_ASPECT_RATIO.width} / ${CARD_IMAGE_ASPECT_RATIO.height}`,
                            overflow: "hidden",
                            borderRadius: 4,
                        }}
                    >
                        <img
                            src={`${apiBaseUrl}/api/media/${cv.imageId}`}
                            alt={cv.title}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                objectPosition: `center ${(cv.imageYOffset ?? 0.5) * 100}%`,
                                display: "block",
                            }}
                        />
                    </Box>
                )}

                <Stack gap={4}>
                    <Group gap="xs" align="baseline">
                        <Text fw={700} size="lg" style={{ flex: 1 }}>
                            {cv.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                            v{cv.versionNumber}
                        </Text>
                    </Group>
                    <Group gap="xs" wrap="wrap">
                        <Tooltip
                            label={
                                card.cardType === "reparations"
                                    ? "Reparations — drawn as a penalty card"
                                    : "Standard chance card"
                            }
                            withArrow
                        >
                            <Badge
                                color={card.cardType === "reparations" ? "red" : "blue"}
                                size="sm"
                            >
                                {card.cardType}
                            </Badge>
                        </Tooltip>
                        {card.isGlobal && (
                            <Tooltip
                                label="In the global pool — eligible for all sessions"
                                withArrow
                            >
                                <Badge size="sm" color="violet">
                                    global
                                </Badge>
                            </Tooltip>
                        )}
                        {card.pendingGlobal && (
                            <Tooltip
                                label="Nominated for global pool — pending admin review"
                                withArrow
                            >
                                <Badge size="sm" color="orange">
                                    nominated
                                </Badge>
                            </Tooltip>
                        )}
                        {!card.active && (
                            <Tooltip label="Inactive — excluded from all draw pools" withArrow>
                                <Badge size="sm" color="gray">
                                    inactive
                                </Badge>
                            </Tooltip>
                        )}
                        {cv.isGameChanger && (
                            <Tooltip
                                label="Game changer — alters gameplay rules mid-session"
                                withArrow
                            >
                                <Badge size="sm" color="yellow">
                                    game changer
                                </Badge>
                            </Tooltip>
                        )}
                    </Group>
                </Stack>

                {/* Levels row — always shown */}
                <Group gap="md">
                    <Tooltip
                        label={drinkingLevelInfo.tooltip || `Drinking: ${drinkingLevelInfo.label}`}
                        withArrow
                    >
                        <Group gap={4}>
                            <Text size="xs" c="dimmed">
                                🍺
                            </Text>
                            <Text size="xs">{drinkingLevelInfo.label}</Text>
                        </Group>
                    </Tooltip>
                    <Tooltip
                        label={spiceLevelInfo.tooltip || `Spice: ${spiceLevelInfo.label}`}
                        withArrow
                    >
                        <Group gap={4}>
                            <Text size="xs" c="dimmed">
                                🌶️
                            </Text>
                            <Text size="xs">{spiceLevelInfo.label}</Text>
                        </Group>
                    </Tooltip>
                </Group>

                <Text size="sm">{cv.description}</Text>

                {cv.hiddenInstructions ? (
                    <Stack gap={2}>
                        <Text size="xs" c="dimmed" fw={500}>
                            HIDDEN INSTRUCTIONS
                        </Text>
                        <Text size="sm" fs="italic">
                            {cv.hiddenInstructions}
                        </Text>
                    </Stack>
                ) : (
                    <Text size="xs" c="dimmed" fs="italic">
                        No hidden instructions
                    </Text>
                )}

                <Group gap="xs" wrap="wrap">
                    <Text size="xs" c="dimmed">
                        Games:
                    </Text>
                    {cv.gameTags.length > 0 ? (
                        cv.gameTags.map((g) => (
                            <Badge key={g.id} size="xs" variant="outline">
                                {g.name}
                            </Badge>
                        ))
                    ) : (
                        <Text size="xs" c="dimmed">
                            none
                        </Text>
                    )}
                </Group>

                <Group gap="xs" wrap="wrap">
                    <Text size="xs" c="dimmed">
                        Requires:
                    </Text>
                    {cv.requirements.length > 0 ? (
                        cv.requirements.map((r) => (
                            <Badge key={r.id} size="xs" variant="dot">
                                {r.title}
                            </Badge>
                        ))
                    ) : (
                        <Text size="xs" c="dimmed">
                            nothing
                        </Text>
                    )}
                </Group>

                <Text size="xs" c="dimmed">
                    Owner: {card.ownerDisplayName} · Author: {cv.authorDisplayName} ·{" "}
                    {formatDate(card.createdAt)}
                    {card.netVotes !== 0 && (
                        <>
                            {" "}
                            ·{" "}
                            <span
                                style={{
                                    color:
                                        card.netVotes > 0
                                            ? "var(--mantine-color-teal-6)"
                                            : "var(--mantine-color-red-6)",
                                }}
                            >
                                {card.netVotes > 0 ? `+${card.netVotes}` : card.netVotes} votes
                            </span>
                        </>
                    )}
                </Text>

                <Divider />

                {/* Primary actions */}
                <Group gap="xs" wrap="wrap">
                    <Button size="xs" variant="outline" onClick={startEdit}>
                        Edit
                    </Button>
                    <Button
                        size="xs"
                        variant="outline"
                        color="teal"
                        onClick={() => void openAnalysis()}
                    >
                        Analyze with AI
                    </Button>
                </Group>

                {/* Secondary / status actions */}
                <Group gap="xs" wrap="wrap">
                    <Button size="xs" variant="subtle" color="orange" onClick={startTransfer}>
                        Transfer ownership
                    </Button>
                    <Button
                        size="xs"
                        variant="subtle"
                        color={card.isGlobal ? "gray" : "violet"}
                        loading={isPending}
                        onClick={() =>
                            action(
                                card.isGlobal
                                    ? `/api/cards/${card.id}/demote`
                                    : `/api/cards/${card.id}/promote`
                            )
                        }
                    >
                        {card.isGlobal ? "Remove from global" : "Promote to global"}
                    </Button>
                    {card.pendingGlobal && !card.isGlobal && (
                        <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            loading={isPending}
                            onClick={() => action(`/api/cards/${card.id}/unnominate`)}
                        >
                            Reject nomination
                        </Button>
                    )}
                    <Button
                        size="xs"
                        variant="subtle"
                        color={card.active ? "red" : "green"}
                        loading={isPending}
                        onClick={() =>
                            action(
                                card.active
                                    ? `/api/cards/${card.id}/deactivate`
                                    : `/api/cards/${card.id}/reactivate`
                            )
                        }
                    >
                        {card.active ? "Deactivate" : "Reactivate"}
                    </Button>
                </Group>

                {versions.length > 0 && (
                    <>
                        <Divider label="Version history" labelPosition="left" />
                        <Stack gap={4}>
                            {versions.map((v) => (
                                <Group key={v.id} gap="xs">
                                    <Text size="xs" c="dimmed" w={20}>
                                        v{v.versionNumber}
                                    </Text>
                                    <Text size="xs" style={{ flex: 1 }} truncate>
                                        {v.title}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        {v.authorDisplayName}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        {formatDate(v.createdAt)}
                                    </Text>
                                </Group>
                            ))}
                        </Stack>
                    </>
                )}
            </Stack>
        </>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CardsPage() {
    const adminFetch = useAdminFetch();
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState<FilterState>({
        search: "",
        active: "",
        isGlobal: "",
        pendingGlobal: "",
        gameId: "",
        drinkingLevel: "",
        spiceLevel: "",
    });
    const [filterGames, setFilterGames] = useState<GameOption[]>([]);
    const [selected, setSelected] = useState<Card | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkAnalysisOpen, setBulkAnalysisOpen] = useState(false);
    const [analyzedCardIdsArr, setAnalyzedCardIdsArr] = useSessionStorage<string[]>({
        key: "admin-analyzed-card-ids",
        defaultValue: [],
    });
    const [acceptedCardIdsArr, setAcceptedCardIdsArr] = useSessionStorage<string[]>({
        key: "admin-accepted-card-ids",
        defaultValue: [],
    });
    const [dismissedCardIdsArr, setDismissedCardIdsArr] = useSessionStorage<string[]>({
        key: "admin-dismissed-card-ids",
        defaultValue: [],
    });
    const [noChangeCardIdsArr, setNoChangeCardIdsArr] = useSessionStorage<string[]>({
        key: "admin-nochange-card-ids",
        defaultValue: [],
    });
    const analyzedCardIds = new Set(analyzedCardIdsArr);
    const acceptedCardIds = new Set(acceptedCardIdsArr);
    const dismissedCardIds = new Set(dismissedCardIdsArr);
    const noChangeCardIds = new Set(noChangeCardIdsArr);
    const [isPending, startTransition] = useTransition();

    const apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "";

    useEffect(() => {
        adminFetch("/api/admin/games")
            .then((r) => r.json())
            .then((d) => {
                if (d.ok) setFilterGames(d.data as GameOption[]);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function loadCards() {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.search) params.set("search", filters.search);
        if (filters.active) params.set("active", filters.active);
        if (filters.isGlobal) params.set("isGlobal", filters.isGlobal);
        if (filters.pendingGlobal) params.set("pendingGlobal", filters.pendingGlobal);
        if (filters.gameId) params.set("gameId", filters.gameId);
        if (filters.drinkingLevel) params.set("drinkingLevel", filters.drinkingLevel);
        if (filters.spiceLevel) params.set("spiceLevel", filters.spiceLevel);

        adminFetch(`/api/cards?${params}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.ok) setCards(d.data as Card[]);
                setLoading(false);
            });
    }

    useEffect(() => {
        loadCards();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    function toggleGlobal(card: Card) {
        startTransition(async () => {
            const url = card.isGlobal
                ? `/api/cards/${card.id}/demote`
                : `/api/cards/${card.id}/promote`;
            const res = await adminFetch(url, { method: "POST" });
            const data = await res.json();
            if (data.ok) {
                setCards((prev) => prev.map((c) => (c.id === card.id ? (data.data as Card) : c)));
                if (selected?.id === card.id) setSelected(data.data as Card);
            } else {
                notifications.show({ message: data.error?.message ?? "Error", color: "red" });
            }
        });
    }

    function handleCardChanged(updated: Card) {
        setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSelected(updated);
    }

    const rows = cards.map((card) => (
        <Table.Tr
            key={card.id}
            style={{ cursor: "pointer" }}
            bg={selected?.id === card.id ? "var(--mantine-color-dark-6)" : undefined}
            onClick={() => setSelected(card)}
        >
            <Table.Td onClick={(e) => e.stopPropagation()}>
                <Tooltip
                    label="Maximum 20 cards selected"
                    disabled={selectedIds.has(card.id) || selectedIds.size < 20}
                    withArrow
                >
                    <Checkbox
                        checked={selectedIds.has(card.id)}
                        disabled={!selectedIds.has(card.id) && selectedIds.size >= 20}
                        onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.currentTarget.checked) next.add(card.id);
                            else next.delete(card.id);
                            setSelectedIds(next);
                        }}
                    />
                </Tooltip>
            </Table.Td>
            <Table.Td>
                {card.currentVersion.imageId ? (
                    <LazyThumbnail imageId={card.currentVersion.imageId} apiBaseUrl={apiBaseUrl} />
                ) : (
                    <div style={{ width: 28, height: 28 }} />
                )}
            </Table.Td>
            <Table.Td>
                <Text size="sm" truncate maw={280}>
                    {card.currentVersion.title}
                </Text>
            </Table.Td>
            <Table.Td>
                <Badge size="xs" color={card.cardType === "reparations" ? "red" : "blue"}>
                    {card.cardType}
                </Badge>
            </Table.Td>
            <Table.Td onClick={(e) => e.stopPropagation()}>
                <Switch
                    checked={card.isGlobal}
                    size="xs"
                    disabled={isPending}
                    onChange={() => toggleGlobal(card)}
                />
            </Table.Td>
            <Table.Td>
                <Group gap={4} wrap="nowrap">
                    {card.currentVersion.isGameChanger && (
                        <Badge size="xs" color="yellow">
                            game changer
                        </Badge>
                    )}
                    {card.pendingGlobal && (
                        <Badge size="xs" color="orange">
                            nominated
                        </Badge>
                    )}
                    {analyzedCardIds.has(card.id) &&
                        (acceptedCardIds.has(card.id) ? (
                            <Tooltip label="AI changes applied" withArrow>
                                <Badge size="xs" color="green">
                                    AI ✓
                                </Badge>
                            </Tooltip>
                        ) : dismissedCardIds.has(card.id) ? (
                            <Tooltip label="AI changes not applied" withArrow>
                                <Badge size="xs" color="gray" variant="outline">
                                    AI ✗
                                </Badge>
                            </Tooltip>
                        ) : noChangeCardIds.has(card.id) ? (
                            <Tooltip label="AI found no changes needed" withArrow>
                                <Badge size="xs" color="teal" variant="light">
                                    AI ✓
                                </Badge>
                            </Tooltip>
                        ) : (
                            <Tooltip label="AI analysis run — decision pending" withArrow>
                                <Badge size="xs" color="yellow" variant="light">
                                    AI
                                </Badge>
                            </Tooltip>
                        ))}
                </Group>
            </Table.Td>
            <Table.Td>
                <Group gap={4} wrap="nowrap">
                    {card.currentVersion.drinkingLevel > 0 && (
                        <Text size="xs" c="dimmed">
                            🍺{card.currentVersion.drinkingLevel}
                        </Text>
                    )}
                    {card.currentVersion.spiceLevel > 0 && (
                        <Text size="xs" c="dimmed">
                            🌶️{card.currentVersion.spiceLevel}
                        </Text>
                    )}
                </Group>
            </Table.Td>
            <Table.Td>
                <Badge size="xs" color={card.active ? "green" : "gray"} variant="dot">
                    {card.active ? "active" : "inactive"}
                </Badge>
            </Table.Td>
            <Table.Td>
                {card.currentVersion.gameTags.length > 0 ? (
                    <Group gap={4} wrap="wrap" maw={160}>
                        {card.currentVersion.gameTags.map((g) => (
                            <Badge key={g.id} size="xs" variant="outline" color="teal">
                                {g.name}
                            </Badge>
                        ))}
                    </Group>
                ) : (
                    <Text size="xs" c="dimmed" fs="italic">
                        all
                    </Text>
                )}
            </Table.Td>
            <Table.Td>
                <Stack gap={0}>
                    <Text size="xs" c="dimmed">
                        {card.ownerDisplayName}
                    </Text>
                    {card.authorUserId !== card.currentVersion.authoredByUserId && (
                        <Text size="xs" c="dimmed" fs="italic">
                            by {card.currentVersion.authorDisplayName}
                        </Text>
                    )}
                </Stack>
            </Table.Td>
            <Table.Td>
                <Text size="xs" c="dimmed">
                    {formatDate(card.createdAt)}
                </Text>
            </Table.Td>
        </Table.Tr>
    ));

    return (
        <>
            <Stack gap="md">
                <Group justify="space-between" align="baseline">
                    <Title order={3}>Cards</Title>
                    {!loading && (
                        <Group gap="md">
                            <Text size="sm" c="dimmed">
                                {cards.length} cards
                            </Text>
                            <Text size="sm" c="dimmed">
                                {cards.filter((c) => c.isGlobal).length} global
                            </Text>
                        </Group>
                    )}
                </Group>

                <Group gap="sm">
                    <TextInput
                        placeholder="Search title…"
                        value={filters.search}
                        onChange={(e) => {
                            const v = e.currentTarget.value;
                            setFilters((f) => ({ ...f, search: v }));
                        }}
                        style={{ flex: 1 }}
                    />
                    <Select
                        placeholder="Status"
                        data={[
                            { value: "true", label: "Active" },
                            { value: "false", label: "Inactive" },
                        ]}
                        value={filters.active || null}
                        onChange={(v) => setFilters((f) => ({ ...f, active: v ?? "" }))}
                        clearable
                        w={130}
                    />
                    <Select
                        placeholder="Global"
                        data={[
                            { value: "true", label: "Global" },
                            { value: "false", label: "Not global" },
                        ]}
                        value={filters.isGlobal || null}
                        onChange={(v) => setFilters((f) => ({ ...f, isGlobal: v ?? "" }))}
                        clearable
                        w={140}
                    />
                    <Select
                        placeholder="Nominated"
                        data={[{ value: "true", label: "Nominated" }]}
                        value={filters.pendingGlobal || null}
                        onChange={(v) => setFilters((f) => ({ ...f, pendingGlobal: v ?? "" }))}
                        clearable
                        w={140}
                    />
                    <Select
                        placeholder="Game"
                        data={filterGames.map((g) => ({ value: g.id, label: g.name }))}
                        value={filters.gameId || null}
                        onChange={(v) => setFilters((f) => ({ ...f, gameId: v ?? "" }))}
                        clearable
                        searchable
                        w={160}
                    />
                    <Select
                        placeholder="Drinking"
                        data={DRINKING_LEVELS.levels.map((l) => ({
                            value: String(l.value),
                            label: l.emoji ? `${l.emoji} ${l.label}` : l.label,
                        }))}
                        value={filters.drinkingLevel || null}
                        onChange={(v) => setFilters((f) => ({ ...f, drinkingLevel: v ?? "" }))}
                        clearable
                        w={150}
                    />
                    <Select
                        placeholder="Spice"
                        data={SPICE_LEVELS.levels.map((l) => ({
                            value: String(l.value),
                            label: l.emoji ? `${l.emoji} ${l.label}` : l.label,
                        }))}
                        value={filters.spiceLevel || null}
                        onChange={(v) => setFilters((f) => ({ ...f, spiceLevel: v ?? "" }))}
                        clearable
                        w={120}
                    />
                </Group>

                {selectedIds.size > 0 && (
                    <Group
                        justify="space-between"
                        px="sm"
                        py="xs"
                        style={{
                            background: "var(--mantine-color-dark-7)",
                            borderRadius: 6,
                        }}
                    >
                        <Group gap="sm">
                            <Text size="sm" fw={500}>
                                {selectedIds.size} selected
                            </Text>
                            <Text size="xs" c="dimmed">
                                (max 20)
                            </Text>
                        </Group>
                        <Group gap="sm">
                            <Button
                                variant="subtle"
                                size="xs"
                                color="gray"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                Clear
                            </Button>
                            <Button
                                size="xs"
                                color="teal"
                                onClick={() => setBulkAnalysisOpen(true)}
                            >
                                Analyze {selectedIds.size} card{selectedIds.size !== 1 ? "s" : ""}
                            </Button>
                        </Group>
                    </Group>
                )}

                {loading ? (
                    <Center py="xl">
                        <Loader />
                    </Center>
                ) : (
                    <ScrollArea>
                        <Table striped highlightOnHover withTableBorder>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th w={40} />
                                    <Table.Th w={36} />
                                    <Table.Th>Title</Table.Th>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th>Global</Table.Th>
                                    <Table.Th>Flags</Table.Th>
                                    <Table.Th>Levels</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Games</Table.Th>
                                    <Table.Th>Owner</Table.Th>
                                    <Table.Th>Created</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>{rows}</Table.Tbody>
                        </Table>
                        <Text size="xs" c="dimmed" mt="xs">
                            {cards.length} cards
                        </Text>
                    </ScrollArea>
                )}
            </Stack>

            <Drawer
                opened={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.currentVersion.title ?? "Card"}
                position="right"
                size="md"
                scrollAreaComponent={ScrollArea.Autosize}
            >
                {selected && (
                    <CardDrawer
                        card={selected}
                        onClose={() => setSelected(null)}
                        onChanged={handleCardChanged}
                        onAnalyzed={(ids) =>
                            setAnalyzedCardIdsArr((prev) => [...new Set([...prev, ...ids])])
                        }
                        onAccepted={(id) =>
                            setAcceptedCardIdsArr((prev) => [...new Set([...prev, id])])
                        }
                        onDismissed={(id) =>
                            setDismissedCardIdsArr((prev) => [...new Set([...prev, id])])
                        }
                        onNoChange={(id) =>
                            setNoChangeCardIdsArr((prev) => [...new Set([...prev, id])])
                        }
                        apiBaseUrl={apiBaseUrl}
                    />
                )}
            </Drawer>

            <BulkAnalysisModal
                opened={bulkAnalysisOpen}
                onClose={() => setBulkAnalysisOpen(false)}
                cards={cards.filter((c) => selectedIds.has(c.id))}
                onCardsChanged={(updated) => {
                    setCards((prev) => prev.map((c) => updated.find((u) => u.id === c.id) ?? c));
                    setSelectedIds(new Set());
                    setBulkAnalysisOpen(false);
                }}
                onAnalyzed={(ids) =>
                    setAnalyzedCardIdsArr((prev) => [...new Set([...prev, ...ids])])
                }
                onNoChange={(ids) =>
                    setNoChangeCardIdsArr((prev) => [...new Set([...prev, ...ids])])
                }
                onAccepted={(ids) =>
                    setAcceptedCardIdsArr((prev) => [...new Set([...prev, ...ids])])
                }
                onDismissed={(ids) =>
                    setDismissedCardIdsArr((prev) => [...new Set([...prev, ...ids])])
                }
            />
        </>
    );
}
