"use client";

import { Button, Group, Tooltip } from "@mantine/core";

interface LevelEntry {
    readonly value: number;
    readonly label: string;
    readonly emoji: string;
    readonly tooltip: string;
}

/**
 * Compact horizontal row of clickable level buttons (0–3).
 *
 * Visual states:
 *   selected                → filled, field color
 *   AI suggestion (not sel) → outline, field color
 *   otherwise               → subtle, gray
 *
 * Tooltips identify which button is the AI suggestion and which is the current card value.
 */
export function LevelPicker({
    levels,
    selected,
    suggested,
    current,
    color,
    onChange,
}: {
    levels: ReadonlyArray<LevelEntry>;
    /** The value that will be applied if the field is checked. */
    selected: number;
    /** The value the AI recommended. */
    suggested: number;
    /** The card's current stored value. */
    current: number;
    /** Mantine color token for "selected" and "outlined" states: "orange" for spice, "blue" for drinking. */
    color: string;
    onChange: (value: number) => void;
}) {
    return (
        <Group gap={4}>
            {levels.map((l) => {
                const isSelected = l.value === selected;
                const isSuggested = l.value === suggested;
                const isCurrent = l.value === current;

                const parts = [l.tooltip || l.label];
                if (isSuggested && isCurrent) parts.push("AI · current");
                else if (isSuggested) parts.push("AI suggestion");
                else if (isCurrent) parts.push("current value");

                return (
                    <Tooltip key={l.value} label={parts.join(" · ")} withArrow>
                        <Button
                            size="compact-xs"
                            variant={isSelected ? "filled" : isSuggested ? "outline" : "subtle"}
                            color={isSelected || isSuggested ? color : "gray"}
                            onClick={() => onChange(l.value)}
                        >
                            {l.emoji || l.label}
                        </Button>
                    </Tooltip>
                );
            })}
        </Group>
    );
}
