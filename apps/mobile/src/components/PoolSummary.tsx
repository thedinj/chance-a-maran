import { DRINKING_LEVELS, SPICE_LEVELS } from "@chance/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { apiClient } from "../lib/api";
import type { FilterSettings, PoolSummary as PoolSummaryType } from "../lib/api/types";

interface Props {
    filterSettings: FilterSettings;
    /** Undefined = create mode (no session yet). */
    sessionId?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
    const pct = max === 0 ? 0 : Math.round((value / max) * 100);
    return (
        <div style={styles.miniBarRow}>
            <span style={styles.miniBarLabel}>{label}</span>
            <div style={styles.miniBarTrack}>
                <div style={{ ...styles.miniBarFill, width: `${pct}%` }} />
            </div>
            <span style={styles.miniBarCount}>{value}</span>
        </div>
    );
}

const BUCKET_CONFIG = [
    {
        key: "priority" as const,
        label: "New cards",
        sublabel: "this session · last 24h",
        color: "var(--color-accent-amber)",
    },
    {
        key: "playerOwned" as const,
        label: "Player pool",
        sublabel: "your cards",
        color: "var(--color-accent-green)",
    },
    {
        key: "global" as const,
        label: "Global pool",
        sublabel: "shared cards",
        color: "var(--color-accent-primary)",
    },
] as const;

function BucketRows({ buckets }: { buckets: PoolSummaryType["standard"]["buckets"] }) {
    return (
        <div style={styles.bucketRows}>
            {BUCKET_CONFIG.map(({ key, label, sublabel, color }) => {
                const { count, drawProbability } = buckets[key];
                if (count === 0) return null;
                const pct = Math.round(drawProbability * 100);
                return (
                    <div key={key} style={styles.bucketRow}>
                        <div style={styles.bucketRowLeft}>
                            <span style={{ ...styles.bucketDot, color }}>{label}</span>
                            <span style={styles.bucketSublabel}>{sublabel}</span>
                        </div>
                        <div style={styles.bucketRowRight}>
                            <div style={styles.bucketTrack}>
                                <div
                                    style={{
                                        ...styles.bucketFill,
                                        width: `${pct}%`,
                                        background: color,
                                    }}
                                />
                            </div>
                            <span style={styles.bucketPct}>{pct}%</span>
                            <span style={styles.bucketCount}>{count}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TypeBreakdown({
    label,
    data,
    isEditMode,
}: {
    label: string;
    data: PoolSummaryType["standard"];
    isEditMode: boolean;
}) {
    const maxDrinking = data.total || 1;
    const maxSpice = data.total || 1;

    return (
        <div style={styles.typeBlock}>
            <div style={styles.typeHeader}>
                <span style={styles.typeLabel}>{label}</span>
                <span style={styles.typeTotal}>{data.total}</span>
                {isEditMode && data.drawn > 0 && (
                    <span style={styles.drawnNote}>
                        {data.drawn} drawn · {data.remaining} left
                    </span>
                )}
            </div>

            {data.total > 0 && (
                <>
                    {/* Bucket breakdown with draw probabilities */}
                    <p style={styles.distLabel}>Draw share</p>
                    <BucketRows buckets={data.buckets} />

                    {/* Drinking level distribution */}
                    <p style={styles.distLabel}>Drinking</p>
                    {DRINKING_LEVELS.levels.map(({ value, label: lvlLabel, emoji }) => (
                        <MiniBar
                            key={value}
                            label={`${emoji || "–"} ${lvlLabel}`}
                            value={data.byDrinkingLevel[String(value)] ?? 0}
                            max={maxDrinking}
                        />
                    ))}

                    {/* Spice level distribution */}
                    <p style={styles.distLabel}>Themes</p>
                    {SPICE_LEVELS.levels.map(({ value, label: lvlLabel, emoji }) => (
                        <MiniBar
                            key={value}
                            label={`${emoji || "–"} ${lvlLabel}`}
                            value={data.bySpiceLevel[String(value)] ?? 0}
                            max={maxSpice}
                        />
                    ))}
                </>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PoolSummary({ filterSettings, sessionId }: Props) {
    const isEditMode = Boolean(sessionId);

    const [debouncedFilters] = useDebouncedValue(filterSettings, 600);

    const { data, isFetching } = useQuery({
        queryKey: ["pool-summary", sessionId ?? "preview", debouncedFilters],
        queryFn: async () => {
            const result = sessionId
                ? await apiClient.getPoolSummary(sessionId, debouncedFilters)
                : await apiClient.previewPool(debouncedFilters);
            return result.ok ? result.data : null;
        },
        staleTime: 30_000,
    });

    const summary = data ?? null;
    const total =
        summary !== null ? summary.standard.total + summary.reparations.total : null;

    return (
        <div style={styles.root}>
            <div style={styles.header}>
                <span style={styles.headerLabel}>POOL PREVIEW</span>
                {isFetching && <span style={styles.updating}>updating…</span>}
            </div>

            {summary === null ? (
                <div style={styles.skeleton}>
                    <div style={styles.skeletonBar} />
                    <div style={{ ...styles.skeletonBar, width: "60%" }} />
                    <div style={{ ...styles.skeletonBar, width: "80%" }} />
                </div>
            ) : total === 0 ? (
                <p style={styles.emptyNote}>
                    No cards match these filters. Try loosening drinking, themes, or game tag
                    settings.
                </p>
            ) : (
                <>
                    <div style={styles.totalRow}>
                        <span style={styles.totalNumber}>{total}</span>
                        <span style={styles.totalSub}>
                            cards eligible
                            {isEditMode &&
                                summary.standard.drawn + summary.reparations.drawn > 0 &&
                                ` · ${summary.standard.drawn + summary.reparations.drawn} already drawn`}
                        </span>
                    </div>

                    <TypeBreakdown
                        label="Chance cards"
                        data={summary.standard}
                        isEditMode={isEditMode}
                    />

                    {summary.reparations.total > 0 && (
                        <TypeBreakdown
                            label="Reparations"
                            data={summary.reparations}
                            isEditMode={isEditMode}
                        />
                    )}
                </>
            )}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    headerLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 600,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.12em",
    },
    updating: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        opacity: 0.6,
        fontStyle: "italic",
    },
    totalRow: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--space-2)",
    },
    totalNumber: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        color: "var(--color-text-primary)",
        lineHeight: 1,
    },
    totalSub: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    typeBlock: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        paddingTop: "var(--space-3)",
        borderTop: "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
    },
    typeHeader: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--space-2)",
    },
    typeLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        fontWeight: 500,
        flex: 1,
    },
    typeTotal: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        fontWeight: 600,
    },
    drawnNote: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },

    // Bucket rows
    bucketRows: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    bucketRow: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        minHeight: "24px",
    },
    bucketRowLeft: {
        display: "flex",
        flexDirection: "column",
        width: "88px",
        flexShrink: 0,
    },
    bucketDot: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 600,
    },
    bucketSublabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        opacity: 0.7,
    },
    bucketRowRight: {
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
    },
    bucketTrack: {
        flex: 1,
        height: "8px",
        background: "var(--color-border)",
        borderRadius: "2px",
        overflow: "hidden",
    },
    bucketFill: {
        height: "100%",
        borderRadius: "2px",
        transition: "width 0.35s ease",
        minWidth: "3px",
    },
    bucketPct: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        width: "32px",
        textAlign: "right",
        flexShrink: 0,
    },
    bucketCount: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        width: "36px",
        textAlign: "right",
        flexShrink: 0,
    },

    // Level distribution
    distLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 600,
        color: "var(--color-text-secondary)",
        letterSpacing: "0.08em",
        margin: "var(--space-1) 0 0",
    },
    miniBarRow: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
    },
    miniBarLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        width: "72px",
        flexShrink: 0,
    },
    miniBarTrack: {
        flex: 1,
        height: "6px",
        background: "var(--color-border)",
        borderRadius: "2px",
        overflow: "hidden",
    },
    miniBarFill: {
        height: "100%",
        background: "var(--color-accent-primary)",
        borderRadius: "2px",
        transition: "width 0.3s ease",
        minWidth: "3px",
    },
    miniBarCount: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        width: "28px",
        textAlign: "right",
        flexShrink: 0,
    },

    emptyNote: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        fontStyle: "italic",
    },
    skeleton: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
    },
    skeletonBar: {
        height: "12px",
        width: "100%",
        background: "var(--color-border)",
        borderRadius: "2px",
        opacity: 0.5,
    },
};
