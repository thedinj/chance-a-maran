"use client";

import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Badge,
    Box,
    Button,
    Checkbox,
    Collapse,
    Divider,
    Group,
    Loader,
    Modal,
    Paper,
    Progress,
    ScrollArea,
    Stack,
    Text,
    Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAdminFetch } from "@/lib/admin/useAdminFetch";
import { DRINKING_LEVELS, SPICE_LEVELS } from "@chance/core";
import type { Card, CardAnalysisResult } from "@chance/core";
import { LevelPicker } from "./LevelPicker";

// ─── CardContentSummary ────────────────────────────────────────────────────────

export function CardContentSummary({
    cv,
    result,
    error,
    apiBaseUrl,
    showImage = false,
}: {
    cv: {
        imageId?: string | null;
        imageYOffset?: number | null;
        description: string;
        hiddenInstructions?: string | null;
    };
    result: CardAnalysisResult | null;
    error?: string | null;
    apiBaseUrl: string;
    showImage?: boolean;
}) {
    return (
        <>
            {showImage && cv.imageId && (
                <Box
                    mb="sm"
                    style={{
                        width: 280,
                        aspectRatio: "16 / 9",
                        borderRadius: 4,
                        overflow: "hidden",
                        background: "var(--mantine-color-dark-5)",
                    }}
                >
                    <img
                        src={`${apiBaseUrl}/api/media/${cv.imageId}`}
                        alt=""
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
            <Paper
                p="xs"
                mb="sm"
                radius="sm"
                style={{ background: "var(--mantine-color-dark-6)" }}
            >
                <Text size="xs" c="dimmed" mb={4}>
                    Content sent to AI
                </Text>
                <Text size="sm" lineClamp={3}>
                    {cv.description}
                </Text>
                {cv.hiddenInstructions && (
                    <Text size="xs" c="dimmed" mt={6}>
                        <Text span fw={500} c="dimmed">
                            Hidden:
                        </Text>{" "}
                        {cv.hiddenInstructions}
                    </Text>
                )}
            </Paper>
            {result && !error && !result.error && (
                <Paper withBorder p="xs" mb="sm" radius="sm">
                    <Text size="xs" c="dimmed" mb={4}>
                        AI justification
                    </Text>
                    <Text size="sm">{result.justification}</Text>
                </Paper>
            )}
        </>
    );
}

// ─── TagPicker ─────────────────────────────────────────────────────────────────

/**
 * Compact wrap of clickable tag buttons for multi-select fields (game tags, requirements).
 *
 * Visual states per tag:
 *   selected                → filled, field color
 *   AI suggestion (not sel) → outline, field color
 *   current card (not sel)  → outline, gray
 *   otherwise               → subtle, gray
 */
function TagPicker({
    allIds,
    lookup,
    selected,
    suggested,
    current,
    color,
    onChange,
}: {
    allIds: string[];
    lookup: Record<string, string>;
    /** IDs that will be applied if the field is checked. */
    selected: string[];
    /** IDs the AI recommended. */
    suggested: string[];
    /** IDs currently on the card. */
    current: string[];
    /** Mantine color token: "violet" for games, "green" for requirements. */
    color: string;
    onChange: (ids: string[]) => void;
}) {
    if (allIds.length === 0) {
        return (
            <Text size="xs" c="dimmed">
                No options available
            </Text>
        );
    }
    return (
        <Group gap={4} wrap="wrap">
            {allIds.map((id) => {
                const isSelected = selected.includes(id);
                const isSuggested = suggested.includes(id);
                const isCurrent = current.includes(id);

                const parts: string[] = [lookup[id] ?? id];
                if (isSuggested && isCurrent) parts.push("AI · current");
                else if (isSuggested) parts.push("AI suggestion");
                else if (isCurrent) parts.push("current");

                return (
                    <Tooltip key={id} label={parts.join(" · ")} withArrow>
                        <Button
                            size="compact-xs"
                            variant={
                                isSelected
                                    ? "filled"
                                    : isSuggested || isCurrent
                                      ? "outline"
                                      : "subtle"
                            }
                            color={isSelected || isSuggested || isCurrent ? color : "gray"}
                            onClick={() =>
                                onChange(
                                    isSelected
                                        ? selected.filter((s) => s !== id)
                                        : [...selected, id]
                                )
                            }
                        >
                            {lookup[id] ?? id}
                        </Button>
                    </Tooltip>
                );
            })}
        </Group>
    );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type CardStatus = "queued" | "analyzing" | "done" | "error";

interface BulkAnalysisModalProps {
    opened: boolean;
    onClose: () => void;
    cards: Card[];
    onCardsChanged: (updated: Card[]) => void;
    onAnalyzed: (versionIds: string[]) => void;
    onNoChange: (versionIds: string[]) => void;
    onAccepted: (versionIds: string[]) => void;
    onDismissed: (versionIds: string[]) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeChangedFields(result: CardAnalysisResult): Set<string> {
    const changed = new Set<string>();
    if (result.current.spiceLevel !== result.suggested.spiceLevel) changed.add("spiceLevel");
    if (result.current.drinkingLevel !== result.suggested.drinkingLevel)
        changed.add("drinkingLevel");
    if (
        [...result.current.gameTagIds].sort().join(",") !==
        [...result.suggested.gameTagIds].sort().join(",")
    )
        changed.add("gameTagIds");
    if (
        [...result.current.requirementElementIds].sort().join(",") !==
        [...result.suggested.requirementElementIds].sort().join(",")
    )
        changed.add("requirementElementIds");
    return changed;
}

function StatusBadge({ status, changed }: { status: CardStatus; changed?: boolean }) {
    if (status === "queued")
        return (
            <Text size="xs" c="dimmed">
                — queued
            </Text>
        );
    if (status === "analyzing")
        return (
            <Group gap={6}>
                <Loader size={12} />
                <Text size="xs" c="dimmed">
                    analyzing…
                </Text>
            </Group>
        );
    if (status === "error")
        return (
            <Badge size="xs" color="red">
                error
            </Badge>
        );
    return changed ? (
        <Badge size="xs" color="teal">
            changed
        </Badge>
    ) : (
        <Badge size="xs" color="gray" variant="outline">
            no change
        </Badge>
    );
}

// ─── Diff field checkboxes ─────────────────────────────────────────────────────

export function CardDiffFields({
    result,
    checked,
    overrides,
    arrayOverrides,
    onToggle,
    onOverride,
    onArrayOverride,
}: {
    result: CardAnalysisResult;
    checked: Set<string>;
    overrides: Map<string, number>;
    arrayOverrides: Map<string, string[]>;
    onToggle: (field: string, value: boolean) => void;
    onOverride: (field: string, value: number) => void;
    onArrayOverride: (field: string, value: string[]) => void;
}) {
    const spiceChanged = result.current.spiceLevel !== result.suggested.spiceLevel;
    const drinkingChanged = result.current.drinkingLevel !== result.suggested.drinkingLevel;
    const tagsChanged =
        [...result.current.gameTagIds].sort().join(",") !==
        [...result.suggested.gameTagIds].sort().join(",");
    const reqChanged =
        [...result.current.requirementElementIds].sort().join(",") !==
        [...result.suggested.requirementElementIds].sort().join(",");

    const spiceSelected =
        overrides.get("spiceLevel") ??
        (spiceChanged ? result.suggested.spiceLevel : result.current.spiceLevel);
    const drinkingSelected =
        overrides.get("drinkingLevel") ??
        (drinkingChanged ? result.suggested.drinkingLevel : result.current.drinkingLevel);
    const tagsSelected =
        arrayOverrides.get("gameTagIds") ??
        (tagsChanged ? result.suggested.gameTagIds : result.current.gameTagIds);
    const reqSelected =
        arrayOverrides.get("requirementElementIds") ??
        (reqChanged
            ? result.suggested.requirementElementIds
            : result.current.requirementElementIds);

    return (
        <Stack gap="xs">
            {/* ── Spice level (always shown) ─────────────────── */}
            <Paper
                withBorder
                p="sm"
                style={{ opacity: spiceChanged || checked.has("spiceLevel") ? 1 : 0.45 }}
            >
                <Stack gap={6}>
                    <Checkbox
                        checked={checked.has("spiceLevel")}
                        onChange={(e) => onToggle("spiceLevel", e.currentTarget.checked)}
                        label={
                            <Text size="sm" fw={500}>
                                Spice level
                            </Text>
                        }
                    />
                    <LevelPicker
                        levels={SPICE_LEVELS.levels}
                        selected={spiceSelected}
                        suggested={result.suggested.spiceLevel}
                        current={result.current.spiceLevel}
                        color="orange"
                        onChange={(v) => {
                            onOverride("spiceLevel", v);
                            if (!spiceChanged) {
                                onToggle("spiceLevel", v !== result.current.spiceLevel);
                            }
                        }}
                    />
                </Stack>
            </Paper>

            {/* ── Drinking level (always shown) ─────────────── */}
            <Paper
                withBorder
                p="sm"
                style={{ opacity: drinkingChanged || checked.has("drinkingLevel") ? 1 : 0.45 }}
            >
                <Stack gap={6}>
                    <Checkbox
                        checked={checked.has("drinkingLevel")}
                        onChange={(e) => onToggle("drinkingLevel", e.currentTarget.checked)}
                        label={
                            <Text size="sm" fw={500}>
                                Drinking level
                            </Text>
                        }
                    />
                    <LevelPicker
                        levels={DRINKING_LEVELS.levels}
                        selected={drinkingSelected}
                        suggested={result.suggested.drinkingLevel}
                        current={result.current.drinkingLevel}
                        color="blue"
                        onChange={(v) => {
                            onOverride("drinkingLevel", v);
                            if (!drinkingChanged) {
                                onToggle("drinkingLevel", v !== result.current.drinkingLevel);
                            }
                        }}
                    />
                </Stack>
            </Paper>

            {/* ── Game tags (always shown) ───────────────────── */}
            <Paper withBorder p="sm">
                <Stack gap={6}>
                    <Checkbox
                        checked={checked.has("gameTagIds")}
                        onChange={(e) => onToggle("gameTagIds", e.currentTarget.checked)}
                        label={
                            <Text size="sm" fw={500}>
                                Game tags
                            </Text>
                        }
                    />
                    <TagPicker
                        allIds={Object.keys(result.gameLookup)}
                        lookup={result.gameLookup}
                        selected={tagsSelected}
                        suggested={result.suggested.gameTagIds}
                        current={result.current.gameTagIds}
                        color="violet"
                        onChange={(ids) => {
                            onArrayOverride("gameTagIds", ids);
                            if (!tagsChanged) {
                                const sorted = [...ids].sort().join(",");
                                const currentSorted = [...result.current.gameTagIds]
                                    .sort()
                                    .join(",");
                                onToggle("gameTagIds", sorted !== currentSorted);
                            }
                        }}
                    />
                </Stack>
            </Paper>

            {/* ── Requirements (always shown) ────────────────── */}
            <Paper withBorder p="sm">
                <Stack gap={6}>
                    <Checkbox
                        checked={checked.has("requirementElementIds")}
                        onChange={(e) => onToggle("requirementElementIds", e.currentTarget.checked)}
                        label={
                            <Text size="sm" fw={500}>
                                Requirements
                            </Text>
                        }
                    />
                    <TagPicker
                        allIds={Object.keys(result.elementLookup)}
                        lookup={result.elementLookup}
                        selected={reqSelected}
                        suggested={result.suggested.requirementElementIds}
                        current={result.current.requirementElementIds}
                        color="green"
                        onChange={(ids) => {
                            onArrayOverride("requirementElementIds", ids);
                            if (!reqChanged) {
                                const sorted = [...ids].sort().join(",");
                                const currentSorted = [...result.current.requirementElementIds]
                                    .sort()
                                    .join(",");
                                onToggle("requirementElementIds", sorted !== currentSorted);
                            }
                        }}
                    />
                </Stack>
            </Paper>
        </Stack>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BulkAnalysisModal({
    opened,
    onClose,
    cards,
    onCardsChanged,
    onAnalyzed,
    onNoChange,
    onAccepted,
    onDismissed,
}: BulkAnalysisModalProps) {
    const adminFetch = useAdminFetch();
    const adminFetchRef = useRef(adminFetch);
    adminFetchRef.current = adminFetch;

    const onAnalyzedRef = useRef(onAnalyzed);
    onAnalyzedRef.current = onAnalyzed;
    const onNoChangeRef = useRef(onNoChange);
    onNoChangeRef.current = onNoChange;
    const onAcceptedRef = useRef(onAccepted);
    onAcceptedRef.current = onAccepted;
    const onDismissedRef = useRef(onDismissed);
    onDismissedRef.current = onDismissed;

    const cancelledRef = useRef(false);
    const apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const [statuses, setStatuses] = useState<Map<string, CardStatus>>(new Map());
    const [results, setResults] = useState<Map<string, CardAnalysisResult>>(new Map());
    const [errors, setErrors] = useState<Map<string, string>>(new Map());
    const [checkedFields, setCheckedFields] = useState<Map<string, Set<string>>>(new Map());
    // Per-card overrides: cardId → (field → value)
    const [overrideValues, setOverrideValues] = useState<Map<string, Map<string, number>>>(
        new Map()
    );
    const [arrayOverrideValues, setArrayOverrideValues] = useState<
        Map<string, Map<string, string[]>>
    >(new Map());
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [applying, setApplying] = useState(false);
    const [applyDone, setApplyDone] = useState(0);

    useEffect(() => {
        if (!opened) {
            cancelledRef.current = true;
            return;
        }

        cancelledRef.current = false;
        const initialStatuses = new Map<string, CardStatus>(cards.map((c) => [c.id, "queued"]));
        setStatuses(initialStatuses);
        setResults(new Map());
        setErrors(new Map());
        setCheckedFields(new Map());
        setOverrideValues(new Map());
        setArrayOverrideValues(new Map());
        setExpandedCards(new Set());
        setApplying(false);
        setApplyDone(0);

        const snapshot = [...cards];

        void (async () => {
            const analyzedVersionIds: string[] = [];
            const noChangeVersionIds: string[] = [];

            for (const card of snapshot) {
                if (cancelledRef.current) break;

                setStatuses((prev) => new Map(prev).set(card.id, "analyzing"));

                try {
                    const res = await adminFetchRef.current("/api/admin/cards/analyze", {
                        method: "POST",
                        body: JSON.stringify({ cardIds: [card.id] }),
                    });
                    const data = (await res.json()) as {
                        ok: boolean;
                        data?: { results: CardAnalysisResult[] };
                        error?: { message: string };
                    };

                    if (cancelledRef.current) break;

                    if (data.ok && data.data) {
                        const result = data.data.results[0];
                        if (!result) continue;

                        setResults((prev) => new Map(prev).set(card.id, result));
                        setStatuses((prev) => new Map(prev).set(card.id, "done"));
                        analyzedVersionIds.push(card.id);

                        if (!result.changed) {
                            noChangeVersionIds.push(card.id);
                        }

                        const changed = computeChangedFields(result);
                        setCheckedFields((prev) => new Map(prev).set(card.id, changed));
                        if (result.changed) {
                            setExpandedCards((prev) => new Set(prev).add(card.id));
                        }
                    } else {
                        setErrors((prev) =>
                            new Map(prev).set(card.id, data.error?.message ?? "Analysis failed")
                        );
                        setStatuses((prev) => new Map(prev).set(card.id, "error"));
                    }
                } catch {
                    if (cancelledRef.current) break;
                    setErrors((prev) => new Map(prev).set(card.id, "Network error"));
                    setStatuses((prev) => new Map(prev).set(card.id, "error"));
                }
            }

            if (analyzedVersionIds.length > 0) onAnalyzedRef.current(analyzedVersionIds);
            if (noChangeVersionIds.length > 0) onNoChangeRef.current(noChangeVersionIds);
        })();

        return () => {
            cancelledRef.current = true;
        };
    }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Derived values ──────────────────────────────────────────────────────────

    const doneCount = Array.from(statuses.values()).filter(
        (s) => s === "done" || s === "error"
    ).length;
    const totalCount = cards.length;
    const progressValue = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
    const isAnalyzing = doneCount < totalCount;

    const totalCheckedFieldCount = Array.from(checkedFields.values()).reduce(
        (sum, fields) => sum + fields.size,
        0
    );

    const cardsToApply = cards.filter((c) => (checkedFields.get(c.id)?.size ?? 0) > 0);

    // ── Handlers ────────────────────────────────────────────────────────────────

    function toggleField(cardId: string, field: string, value: boolean) {
        setCheckedFields((prev) => {
            const next = new Map(prev);
            const fields = new Set(prev.get(cardId) ?? []);
            if (value) fields.add(field);
            else fields.delete(field);
            next.set(cardId, fields);
            return next;
        });
    }

    function setOverride(cardId: string, field: string, value: number) {
        setOverrideValues((prev) => {
            const next = new Map(prev);
            const cardOverrides = new Map(prev.get(cardId) ?? []);
            cardOverrides.set(field, value);
            next.set(cardId, cardOverrides);
            return next;
        });
    }

    function setArrayOverride(cardId: string, field: string, value: string[]) {
        setArrayOverrideValues((prev) => {
            const next = new Map(prev);
            const cardOverrides = new Map(prev.get(cardId) ?? []);
            cardOverrides.set(field, value);
            next.set(cardId, cardOverrides);
            return next;
        });
    }

    function toggleCard(cardId: string) {
        setExpandedCards((prev) => {
            const next = new Set(prev);
            if (next.has(cardId)) next.delete(cardId);
            else next.add(cardId);
            return next;
        });
    }

    function selectAllChanged() {
        setCheckedFields((prev) => {
            const next = new Map(prev);
            for (const card of cards) {
                const result = results.get(card.id);
                if (result?.changed) {
                    next.set(card.id, computeChangedFields(result));
                }
            }
            return next;
        });
    }

    function deselectAll() {
        setCheckedFields((prev) => {
            const next = new Map(prev);
            for (const card of cards) {
                next.set(card.id, new Set());
            }
            return next;
        });
    }

    async function applyAll() {
        setApplying(true);
        setApplyDone(0);

        const updatedCards: Card[] = [];
        const acceptedVersionIds: string[] = [];
        const dismissedVersionIds: string[] = [];

        await Promise.all(
            cards.map(async (card) => {
                const result = results.get(card.id);
                const fields = checkedFields.get(card.id);

                if (!result || statuses.get(card.id) !== "done") return;

                // Cards with no changes AND no overrides/checks are skipped silently
                if (!result.changed && (!fields || fields.size === 0)) return;

                if (!fields || fields.size === 0) {
                    if (result.changed) dismissedVersionIds.push(card.id);
                    return;
                }

                const cardOverrides = overrideValues.get(card.id) ?? new Map<string, number>();
                const cardArrayOverrides =
                    arrayOverrideValues.get(card.id) ?? new Map<string, string[]>();
                const cv = card.currentVersion;
                const suggested = result.suggested;

                const effectiveSpice = cardOverrides.get("spiceLevel") ?? suggested.spiceLevel;
                const effectiveDrinking =
                    cardOverrides.get("drinkingLevel") ?? suggested.drinkingLevel;
                const effectiveGameTags =
                    cardArrayOverrides.get("gameTagIds") ?? suggested.gameTagIds;
                const effectiveRequirements =
                    cardArrayOverrides.get("requirementElementIds") ??
                    suggested.requirementElementIds;

                const payload = {
                    title: cv.title,
                    description: cv.description,
                    hiddenInstructions: cv.hiddenInstructions ?? null,
                    imageId: cv.imageId ?? null,
                    imageYOffset: cv.imageYOffset ?? 0.5,
                    drinkingLevel: fields.has("drinkingLevel")
                        ? effectiveDrinking
                        : cv.drinkingLevel,
                    spiceLevel: fields.has("spiceLevel") ? effectiveSpice : cv.spiceLevel,
                    isGameChanger: cv.isGameChanger,
                    cardType: card.cardType,
                    gameTags: fields.has("gameTagIds")
                        ? effectiveGameTags
                        : cv.gameTags.map((g) => g.id),
                    requirementIds: fields.has("requirementElementIds")
                        ? effectiveRequirements
                        : cv.requirements.map((r) => r.id),
                };

                const res = await adminFetchRef.current(`/api/cards/${card.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                const data = (await res.json()) as { ok: boolean; data?: Card };
                if (data.ok && data.data) {
                    updatedCards.push(data.data);
                    acceptedVersionIds.push(card.id);
                    setApplyDone((prev) => prev + 1);
                }
            })
        );

        setApplying(false);
        notifications.show({
            message: `${updatedCards.length} card${updatedCards.length !== 1 ? "s" : ""} updated`,
            color: "teal",
        });
        if (acceptedVersionIds.length > 0) onAcceptedRef.current(acceptedVersionIds);
        if (dismissedVersionIds.length > 0) onDismissedRef.current(dismissedVersionIds);
        onCardsChanged(updatedCards);
    }

    function handleClose() {
        if (applying) return;
        const dismissedVersionIds: string[] = [];
        for (const card of cards) {
            const result = results.get(card.id);
            const status = statuses.get(card.id);
            if (result?.changed && status === "done") {
                dismissedVersionIds.push(card.id);
            }
        }
        if (dismissedVersionIds.length > 0) onDismissedRef.current(dismissedVersionIds);
        onClose();
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    const hasAnyDone = doneCount > 0;

    return (
        <Modal
            opened={opened}
            onClose={handleClose}
            title={
                isAnalyzing
                    ? `Bulk AI Analysis (${doneCount} of ${totalCount})`
                    : `Bulk AI Analysis — ${totalCount} card${totalCount !== 1 ? "s" : ""}`
            }
            size={800}
        >
            <Stack gap="md">
                <Progress value={progressValue} animated={isAnalyzing} color="teal" size="sm" />

                {hasAnyDone && (
                    <Group gap="xs">
                        <Button variant="subtle" size="xs" color="teal" onClick={selectAllChanged}>
                            Select all changed
                        </Button>
                        <Button variant="subtle" size="xs" color="gray" onClick={deselectAll}>
                            Deselect all
                        </Button>
                    </Group>
                )}

                <Divider />

                <ScrollArea.Autosize mah={480}>
                    <Stack gap="xs">
                        {cards.map((card) => {
                            const status = statuses.get(card.id) ?? "queued";
                            const result = results.get(card.id);
                            const error = errors.get(card.id);
                            const checked = checkedFields.get(card.id) ?? new Set<string>();
                            const overrides =
                                overrideValues.get(card.id) ?? new Map<string, number>();
                            const arrayOverrides =
                                arrayOverrideValues.get(card.id) ?? new Map<string, string[]>();
                            const isExpanded = expandedCards.has(card.id);
                            const isDone = status === "done";
                            const cv = card.currentVersion;

                            return (
                                <Box
                                    key={card.id}
                                    style={{
                                        border: "1px solid var(--mantine-color-dark-4)",
                                        borderRadius: 6,
                                        overflow: "hidden",
                                    }}
                                >
                                    <Group
                                        p="sm"
                                        justify="space-between"
                                        style={{ cursor: isDone ? "pointer" : "default" }}
                                        onClick={() => isDone && toggleCard(card.id)}
                                    >
                                        <Group gap="xs" style={{ minWidth: 0, flex: 1 }}>
                                            {isDone && (
                                                <Text
                                                    size="xs"
                                                    c="dimmed"
                                                    style={{ userSelect: "none", flexShrink: 0 }}
                                                >
                                                    {isExpanded ? "▼" : "▶"}
                                                </Text>
                                            )}
                                            {cv.imageId && (
                                                <div
                                                    style={{
                                                        flexShrink: 0,
                                                        width: 57,
                                                        aspectRatio: "16 / 9",
                                                        borderRadius: 3,
                                                        overflow: "hidden",
                                                        background: "var(--mantine-color-dark-5)",
                                                    }}
                                                >
                                                    <img
                                                        src={`${apiBaseUrl}/api/media/${cv.imageId}`}
                                                        alt=""
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit: "cover",
                                                            objectPosition: `center ${(cv.imageYOffset ?? 0.5) * 100}%`,
                                                            display: "block",
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
                                                {cv.title}
                                            </Text>
                                        </Group>
                                        <StatusBadge status={status} changed={result?.changed} />
                                    </Group>

                                    <Collapse expanded={isExpanded && isDone}>
                                        {result && (
                                            <Box px="sm" pb="sm">
                                                <CardContentSummary
                                                    cv={cv}
                                                    result={result}
                                                    error={error}
                                                    apiBaseUrl={apiBaseUrl}
                                                />

                                                {error || result.error ? (
                                                    <Alert color="red" py="xs">
                                                        {error ?? result.error}
                                                    </Alert>
                                                ) : (
                                                    <CardDiffFields
                                                        result={result}
                                                        checked={checked}
                                                        overrides={overrides}
                                                        arrayOverrides={arrayOverrides}
                                                        onToggle={(field, value) =>
                                                            toggleField(card.id, field, value)
                                                        }
                                                        onOverride={(field, value) =>
                                                            setOverride(card.id, field, value)
                                                        }
                                                        onArrayOverride={(field, value) =>
                                                            setArrayOverride(card.id, field, value)
                                                        }
                                                    />
                                                )}
                                            </Box>
                                        )}
                                    </Collapse>
                                </Box>
                            );
                        })}
                    </Stack>
                </ScrollArea.Autosize>

                <Divider />
                <Group justify="space-between" align="center">
                    <Button variant="subtle" color="gray" onClick={handleClose} disabled={applying}>
                        {isAnalyzing ? "Cancel" : "Close"}
                    </Button>

                    {applying ? (
                        <Text size="xs" c="dimmed">
                            Applying {applyDone} / {cardsToApply.length}…
                        </Text>
                    ) : (
                        <Tooltip
                            label="No fields selected"
                            disabled={totalCheckedFieldCount > 0}
                            withArrow
                        >
                            <Button
                                color="teal"
                                disabled={totalCheckedFieldCount === 0}
                                loading={applying}
                                onClick={() => void applyAll()}
                            >
                                Apply selected ({totalCheckedFieldCount} field
                                {totalCheckedFieldCount !== 1 ? "s" : ""})
                            </Button>
                        </Tooltip>
                    )}
                </Group>
            </Stack>
        </Modal>
    );
}
