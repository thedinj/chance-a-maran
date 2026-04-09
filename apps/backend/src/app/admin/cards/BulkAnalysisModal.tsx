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

// ─── Types ─────────────────────────────────────────────────────────────────────

type CardStatus = "queued" | "analyzing" | "done" | "error";

interface BulkAnalysisModalProps {
    opened: boolean;
    onClose: () => void;
    cards: Card[];
    onCardsChanged: (updated: Card[]) => void;
    onAnalyzed: (versionIds: string[]) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function computeChangedFields(result: CardAnalysisResult): Set<string> {
    const changed = new Set<string>();
    if (result.current.spiceLevel !== result.suggested.spiceLevel) changed.add("spiceLevel");
    if (result.current.drinkingLevel !== result.suggested.drinkingLevel) changed.add("drinkingLevel");
    if ([...result.current.gameTagIds].sort().join(",") !== [...result.suggested.gameTagIds].sort().join(","))
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
    // done
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

// ─── Diff field checkboxes (reusable for one card's result) ───────────────────

function CardDiffFields({
    result,
    checked,
    onToggle,
}: {
    result: CardAnalysisResult;
    checked: Set<string>;
    onToggle: (field: string, value: boolean) => void;
}) {
    const spiceChanged = result.current.spiceLevel !== result.suggested.spiceLevel;
    const drinkingChanged = result.current.drinkingLevel !== result.suggested.drinkingLevel;
    const tagsChanged =
        [...result.current.gameTagIds].sort().join(",") !==
        [...result.suggested.gameTagIds].sort().join(",");
    const reqChanged =
        [...result.current.requirementElementIds].sort().join(",") !==
        [...result.suggested.requirementElementIds].sort().join(",");

    if (!spiceChanged && !drinkingChanged && !tagsChanged && !reqChanged) {
        return (
            <Text size="sm" c="dimmed" ta="center" py="xs">
                No changes recommended — categorization looks good.
            </Text>
        );
    }

    return (
        <Stack gap="xs">
            {spiceChanged && (
                <Paper withBorder p="sm">
                    <Checkbox
                        checked={checked.has("spiceLevel")}
                        onChange={(e) => onToggle("spiceLevel", e.currentTarget.checked)}
                        label={
                            <Group gap="xs">
                                <Text size="sm" fw={500}>
                                    Spice level
                                </Text>
                                <Badge size="xs" color="gray" variant="outline">
                                    {SPICE_LEVELS.levels[result.current.spiceLevel].emoji ||
                                        SPICE_LEVELS.levels[result.current.spiceLevel].label}
                                </Badge>
                                <Text size="xs" c="dimmed">
                                    →
                                </Text>
                                <Badge size="xs" color="orange" variant="light">
                                    {SPICE_LEVELS.levels[result.suggested.spiceLevel].emoji ||
                                        SPICE_LEVELS.levels[result.suggested.spiceLevel].label}
                                </Badge>
                            </Group>
                        }
                    />
                </Paper>
            )}

            {drinkingChanged && (
                <Paper withBorder p="sm">
                    <Checkbox
                        checked={checked.has("drinkingLevel")}
                        onChange={(e) => onToggle("drinkingLevel", e.currentTarget.checked)}
                        label={
                            <Group gap="xs">
                                <Text size="sm" fw={500}>
                                    Drinking level
                                </Text>
                                <Badge size="xs" color="gray" variant="outline">
                                    {DRINKING_LEVELS.levels[result.current.drinkingLevel].emoji ||
                                        DRINKING_LEVELS.levels[result.current.drinkingLevel].label}
                                </Badge>
                                <Text size="xs" c="dimmed">
                                    →
                                </Text>
                                <Badge size="xs" color="blue" variant="light">
                                    {DRINKING_LEVELS.levels[result.suggested.drinkingLevel].emoji ||
                                        DRINKING_LEVELS.levels[result.suggested.drinkingLevel].label}
                                </Badge>
                            </Group>
                        }
                    />
                </Paper>
            )}

            {tagsChanged && (
                <Paper withBorder p="sm">
                    <Checkbox
                        checked={checked.has("gameTagIds")}
                        onChange={(e) => onToggle("gameTagIds", e.currentTarget.checked)}
                        label={
                            <Stack gap={4}>
                                <Text size="sm" fw={500}>
                                    Game tags
                                </Text>
                                <Group gap={4}>
                                    {result.current.gameTagIds.length === 0 ? (
                                        <Text size="xs" c="dimmed">
                                            none
                                        </Text>
                                    ) : (
                                        result.current.gameTagIds.map((id) => (
                                            <Badge key={id} size="xs" color="gray" variant="outline">
                                                {result.gameLookup[id] ?? id}
                                            </Badge>
                                        ))
                                    )}
                                    <Text size="xs" c="dimmed">
                                        →
                                    </Text>
                                    {result.suggested.gameTagIds.length === 0 ? (
                                        <Text size="xs" c="dimmed">
                                            none
                                        </Text>
                                    ) : (
                                        result.suggested.gameTagIds.map((id) => (
                                            <Badge key={id} size="xs" color="violet" variant="light">
                                                {result.gameLookup[id] ?? id}
                                            </Badge>
                                        ))
                                    )}
                                </Group>
                            </Stack>
                        }
                    />
                </Paper>
            )}

            {reqChanged && (
                <Paper withBorder p="sm">
                    <Checkbox
                        checked={checked.has("requirementElementIds")}
                        onChange={(e) => onToggle("requirementElementIds", e.currentTarget.checked)}
                        label={
                            <Stack gap={4}>
                                <Text size="sm" fw={500}>
                                    Requirements
                                </Text>
                                <Group gap={4}>
                                    {result.current.requirementElementIds.length === 0 ? (
                                        <Text size="xs" c="dimmed">
                                            none
                                        </Text>
                                    ) : (
                                        result.current.requirementElementIds.map((id) => (
                                            <Badge key={id} size="xs" color="gray" variant="outline">
                                                {result.elementLookup[id] ?? id}
                                            </Badge>
                                        ))
                                    )}
                                    <Text size="xs" c="dimmed">
                                        →
                                    </Text>
                                    {result.suggested.requirementElementIds.length === 0 ? (
                                        <Text size="xs" c="dimmed">
                                            none
                                        </Text>
                                    ) : (
                                        result.suggested.requirementElementIds.map((id) => (
                                            <Badge key={id} size="xs" color="green" variant="light">
                                                {result.elementLookup[id] ?? id}
                                            </Badge>
                                        ))
                                    )}
                                </Group>
                            </Stack>
                        }
                    />
                </Paper>
            )}
        </Stack>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BulkAnalysisModal({ opened, onClose, cards, onCardsChanged, onAnalyzed }: BulkAnalysisModalProps) {
    const adminFetch = useAdminFetch();
    const adminFetchRef = useRef(adminFetch);
    adminFetchRef.current = adminFetch;

    const onAnalyzedRefCapture = useRef(onAnalyzed);
    onAnalyzedRefCapture.current = onAnalyzed;

    const cancelledRef = useRef(false);

    const [statuses, setStatuses] = useState<Map<string, CardStatus>>(new Map());
    const [results, setResults] = useState<Map<string, CardAnalysisResult>>(new Map());
    const [errors, setErrors] = useState<Map<string, string>>(new Map());
    const [checkedFields, setCheckedFields] = useState<Map<string, Set<string>>>(new Map());
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
    const [applying, setApplying] = useState(false);
    const [applyDone, setApplyDone] = useState(0);

    // Kick off sequential analysis when modal opens
    useEffect(() => {
        if (!opened) {
            cancelledRef.current = true;
            return;
        }

        // Reset for this run
        cancelledRef.current = false;
        const initialStatuses = new Map<string, CardStatus>(cards.map((c) => [c.id, "queued"]));
        setStatuses(initialStatuses);
        setResults(new Map());
        setErrors(new Map());
        setCheckedFields(new Map());
        setExpandedCards(new Set());
        setApplying(false);
        setApplyDone(0);

        const snapshot = [...cards];

        void (async () => {
            const analyzedVersionIds: string[] = [];

            for (const card of snapshot) {
                if (cancelledRef.current) break;

                setStatuses((prev) => new Map(prev).set(card.id, "analyzing"));

                try {
                    const res = await adminFetchRef.current("/api/admin/cards/analyze", {
                        method: "POST",
                        body: JSON.stringify({ cardIds: [card.id] }),
                    });
                    const data = await res.json() as { ok: boolean; data?: { results: CardAnalysisResult[] }; error?: { message: string } };

                    if (cancelledRef.current) break;

                    if (data.ok && data.data) {
                        const result = data.data.results[0];
                        if (!result) continue;

                        setResults((prev) => new Map(prev).set(card.id, result));
                        setStatuses((prev) => new Map(prev).set(card.id, "done"));
                        analyzedVersionIds.push(card.currentVersionId);

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

            if (analyzedVersionIds.length > 0) {
                onAnalyzedRefCapture.current(analyzedVersionIds);
            }
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

        await Promise.all(
            cardsToApply.map(async (card) => {
                const result = results.get(card.id);
                const fields = checkedFields.get(card.id);
                if (!result || !fields || fields.size === 0) return;

                const cv = card.currentVersion;
                const suggested = result.suggested;

                const payload = {
                    title: cv.title,
                    description: cv.description,
                    hiddenInstructions: cv.hiddenInstructions ?? null,
                    imageId: cv.imageId ?? "",
                    imageYOffset: cv.imageYOffset ?? 0.5,
                    drinkingLevel: fields.has("drinkingLevel") ? suggested.drinkingLevel : cv.drinkingLevel,
                    spiceLevel: fields.has("spiceLevel") ? suggested.spiceLevel : cv.spiceLevel,
                    isGameChanger: cv.isGameChanger,
                    cardType: card.cardType,
                    gameTags: fields.has("gameTagIds")
                        ? suggested.gameTagIds
                        : cv.gameTags.map((g) => g.id),
                    requirementIds: fields.has("requirementElementIds")
                        ? suggested.requirementElementIds
                        : cv.requirements.map((r) => r.id),
                };

                const res = await adminFetchRef.current(`/api/cards/${card.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });
                const data = await res.json() as { ok: boolean; data?: Card };
                if (data.ok && data.data) {
                    updatedCards.push(data.data);
                    setApplyDone((prev) => prev + 1);
                }
            })
        );

        setApplying(false);
        notifications.show({
            message: `${updatedCards.length} card${updatedCards.length !== 1 ? "s" : ""} updated`,
            color: "teal",
        });
        onCardsChanged(updatedCards);
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    const hasAnyDone = doneCount > 0;

    return (
        <Modal
            opened={opened}
            onClose={() => !applying && onClose()}
            title={
                isAnalyzing
                    ? `Bulk AI Analysis (${doneCount} of ${totalCount})`
                    : `Bulk AI Analysis — ${totalCount} card${totalCount !== 1 ? "s" : ""}`
            }
            size="lg"
        >
            <Stack gap="md">
                {/* Progress bar */}
                <Progress value={progressValue} animated={isAnalyzing} color="teal" size="sm" />

                {/* Bulk selection controls — only show once at least one result is in */}
                {hasAnyDone && (
                    <Group gap="xs">
                        <Button
                            variant="subtle"
                            size="xs"
                            color="teal"
                            onClick={selectAllChanged}
                        >
                            Select all changed
                        </Button>
                        <Button
                            variant="subtle"
                            size="xs"
                            color="gray"
                            onClick={deselectAll}
                        >
                            Deselect all
                        </Button>
                    </Group>
                )}

                <Divider />

                {/* Card list */}
                <ScrollArea.Autosize mah={480}>
                    <Stack gap="xs">
                        {cards.map((card) => {
                            const status = statuses.get(card.id) ?? "queued";
                            const result = results.get(card.id);
                            const error = errors.get(card.id);
                            const checked = checkedFields.get(card.id) ?? new Set<string>();
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
                                    {/* Row header */}
                                    <Group
                                        p="sm"
                                        justify="space-between"
                                        style={{ cursor: isDone ? "pointer" : "default" }}
                                        onClick={() => isDone && toggleCard(card.id)}
                                    >
                                        <Group gap="xs">
                                            {isDone && (
                                                <Text size="xs" c="dimmed" style={{ userSelect: "none" }}>
                                                    {isExpanded ? "▼" : "▶"}
                                                </Text>
                                            )}
                                            <Text size="sm" fw={500}>
                                                {cv.title}
                                            </Text>
                                        </Group>
                                        <StatusBadge status={status} changed={result?.changed} />
                                    </Group>

                                    {/* Expandable body */}
                                    <Collapse expanded={isExpanded && isDone}>
                                        {result && (
                                            <Box px="sm" pb="sm">
                                                {/* Card content block */}
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

                                                {/* Error or diff */}
                                                {error || result.error ? (
                                                    <Alert color="red" py="xs">
                                                        {error ?? result.error}
                                                    </Alert>
                                                ) : (
                                                    <CardDiffFields
                                                        result={result}
                                                        checked={checked}
                                                        onToggle={(field, value) =>
                                                            toggleField(card.id, field, value)
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

                {/* Footer */}
                <Divider />
                <Group justify="space-between" align="center">
                    <Button variant="subtle" color="gray" onClick={onClose} disabled={applying}>
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
