import { IonContent, IonPage } from "@ionic/react";
import React, { useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { apiClient } from "../lib/api";
import type { DrawEvent, Player, SessionState } from "../lib/api/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPICE_LABELS: Record<number, string> = { 0: "G", 1: "PG", 2: "PG-13", 3: "R" };
const DRINK_EMOJI: Record<number, string> = { 1: "🍺", 2: "🍺🍺", 3: "🍺🍺🍺" };

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDuration(startIso: string, endIso: string | null): string {
    if (!endIso) return "--";
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (ms <= 0) return "--";
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

// ─── DrawEntry ────────────────────────────────────────────────────────────────

function DrawEntry({
    event,
    playerName,
    expanded,
    onToggle,
}: {
    event: DrawEvent;
    playerName: string;
    expanded: boolean;
    onToggle: () => void;
}) {
    const cv = event.cardVersion;
    const drinkEmoji = cv.drinkingLevel > 0 ? DRINK_EMOJI[cv.drinkingLevel] : null;
    const spiceLabel = cv.spiceLevel > 0 ? SPICE_LABELS[cv.spiceLevel] : null;
    const showLock = cv.hiddenInstructions !== null && !event.descriptionShared;

    return (
        <button style={styles.drawEntry} onClick={onToggle} aria-expanded={expanded}>
            <div style={styles.drawEntryTop}>
                <span style={styles.drawPlayer}>{playerName}</span>
                <span style={styles.drawTime}>
                    {formatTime(event.drawnAt)}
                    {cv.isGameChanger && <span style={styles.starBadge}> ★</span>}
                </span>
            </div>
            <div style={styles.drawEntryBottom}>
                <span style={styles.drawTitle}>{cv.title}</span>
                <span style={styles.drawBadges}>
                    {drinkEmoji && <span style={styles.badge}>{drinkEmoji}</span>}
                    {spiceLabel && <span style={styles.badge}>{spiceLabel}</span>}
                    {event.resolved && <span style={styles.badge}>✓</span>}
                    {showLock && <span style={styles.badge}>🔒</span>}
                </span>
            </div>
            {expanded && (
                <div style={styles.drawDescription}>
                    {showLock ? (
                        <span style={styles.descLocked}>Description was hidden</span>
                    ) : (
                        <span style={styles.descText}>{cv.description}</span>
                    )}
                </div>
            )}
        </button>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GameHistory() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const history = useHistory();

    const [sessionState, setSessionState] = useState<SessionState | null>(null);
    const [expandedDrawId, setExpandedDrawId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!sessionId) return;
        apiClient.getSessionState(sessionId).then((r) => {
            if (r.ok) setSessionState(r.data);
            setLoading(false);
        });
    }, [sessionId]);

    const playerMap = useMemo<Map<string, Player>>(() => {
        if (!sessionState) return new Map();
        return new Map(sessionState.players.map((p) => [p.id, p]));
    }, [sessionState]);

    const playerDrawCounts = useMemo<Map<string, number>>(() => {
        if (!sessionState) return new Map();
        const counts = new Map<string, number>();
        for (const de of sessionState.drawEvents) {
            counts.set(de.playerId, (counts.get(de.playerId) ?? 0) + 1);
        }
        return counts;
    }, [sessionState]);

    const gameChangerCount = useMemo(() => {
        if (!sessionState) return 0;
        return sessionState.drawEvents.filter((de) => de.cardVersion.isGameChanger).length;
    }, [sessionState]);

    // Players sorted by draw count desc
    const sortedPlayers = useMemo(() => {
        if (!sessionState) return [];
        return [...sessionState.players].sort(
            (a, b) => (playerDrawCounts.get(b.id) ?? 0) - (playerDrawCounts.get(a.id) ?? 0)
        );
    }, [sessionState, playerDrawCounts]);

    function toggleDraw(id: string) {
        setExpandedDrawId((prev) => (prev === id ? null : id));
    }

    if (loading) {
        return (
            <IonPage>
                <AppHeader />
                <IonContent>
                    <div style={styles.root}>
                        <div style={styles.pageHeader}>
                            <button style={styles.backLink} onClick={() => history.goBack()}>
                                «
                            </button>
                        </div>
                        <div style={styles.emptyState}>
                            <p style={styles.emptyText}>Loading…</p>
                        </div>
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    if (!sessionState) {
        return (
            <IonPage>
                <AppHeader />
                <IonContent>
                    <div style={styles.root}>
                        <div style={styles.pageHeader}>
                            <button style={styles.backLink} onClick={() => history.goBack()}>
                                «
                            </button>
                        </div>
                        <div style={styles.emptyState}>
                            <p style={styles.emptyText}>Session not found.</p>
                        </div>
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    const { session, drawEvents } = sessionState;
    const duration = formatDuration(session.createdAt, session.endedAt);

    return (
        <IonPage>
            <AppHeader />
            <IonContent>
                <div style={styles.root}>
                    <div style={styles.pageHeader}>
                        <button style={styles.backLink} onClick={() => history.goBack()}>
                            «
                        </button>
                        <h1 style={styles.heading}>{session.name}</h1>
                    </div>

                    {/* ── Header meta ──────────────────────────────────────────── */}
                    <div style={styles.metaBlock}>
                        <p style={styles.metaDate}>{formatDate(session.createdAt)}</p>
                        <p style={styles.metaDuration}>{duration}</p>
                    </div>

                    {/* ── Stats row ────────────────────────────────────────────── */}
                    <div style={styles.statsRow}>
                        <span style={styles.statItem}>{drawEvents.length} draws</span>
                        {gameChangerCount > 0 && (
                            <span style={styles.statItem}>★ {gameChangerCount} game changers</span>
                        )}
                    </div>

                    {/* ── Player chips ─────────────────────────────────────────── */}
                    {sortedPlayers.length > 0 && (
                        <div style={styles.chipsScroll}>
                            {sortedPlayers.map((p) => (
                                <div key={p.id} style={styles.chip}>
                                    <span style={styles.chipName}>{p.displayName}</span>
                                    <span style={styles.chipCount}>
                                        {playerDrawCounts.get(p.id) ?? 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Draw log ─────────────────────────────────────────────── */}
                    <p style={styles.sectionLabel}>DRAW LOG</p>

                    {drawEvents.length === 0 ? (
                        <p style={styles.emptyLog}>No cards were drawn in this session.</p>
                    ) : (
                        <div style={styles.drawList}>
                            {drawEvents.map((event) => {
                                const player = playerMap.get(event.playerId);
                                const name = player?.displayName ?? "Unknown";
                                return (
                                    <DrawEntry
                                        key={event.id}
                                        event={event}
                                        playerName={name}
                                        expanded={expandedDrawId === event.id}
                                        onToggle={() => toggleDraw(event.id)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </IonContent>
        </IonPage>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg)",
        paddingTop: "var(--space-5)",
        paddingLeft: "var(--space-5)",
        paddingRight: "var(--space-5)",
        paddingBottom: "calc(var(--space-8) + env(safe-area-inset-bottom))",
        gap: "var(--space-1)",
        minHeight: "100%",
    },
    pageHeader: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "0 0 var(--space-3)",
        marginLeft: "calc(-1 * var(--space-1))",
    },
    backLink: {
        background: "none",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-subheading)",
        color: "var(--color-accent-primary)",
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
        minHeight: "44px",
        minWidth: "44px",
        display: "flex",
        alignItems: "center",
    },
    heading: {
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-heading)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        margin: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },

    // ── Meta ─────────────────────────────────────────────────────────────────
    metaBlock: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--space-3)",
        marginBottom: "var(--space-2)",
    },
    metaDate: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    metaDuration: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        margin: 0,
        opacity: 0.7,
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    statsRow: {
        display: "flex",
        gap: "var(--space-4)",
        marginBottom: "var(--space-4)",
    },
    statItem: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        fontWeight: 500,
    },

    // ── Player chips ──────────────────────────────────────────────────────────
    chipsScroll: {
        display: "flex",
        flexDirection: "row",
        overflowX: "auto",
        gap: "var(--space-2)",
        marginBottom: "var(--space-5)",
        paddingBottom: "var(--space-1)",
        WebkitOverflowScrolling: "touch",
    },
    chip: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        background: "var(--color-surface-elevated)",
        border: "1px solid color-mix(in srgb, var(--color-accent-primary) 35%, transparent)",
        borderRadius: "5px",
        padding: "0 var(--space-3)",
        height: "38px",
        flexShrink: 0,
        whiteSpace: "nowrap",
    },
    chipName: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    chipCount: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-primary)",
        fontWeight: 600,
    },

    // ── Draw log ──────────────────────────────────────────────────────────────
    sectionLabel: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        fontWeight: 600,
        letterSpacing: "0.12em",
        color: "var(--color-text-secondary)",
        margin: 0,
        marginBottom: "var(--space-2)",
        marginTop: "var(--space-3)",
    },
    drawList: {
        display: "flex",
        flexDirection: "column",
    },
    drawEntry: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        background: "none",
        border: "none",
        borderBottom: "1px solid var(--color-border)",
        padding: "var(--space-3) 0",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
    },
    drawEntryTop: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
    },
    drawPlayer: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
    },
    drawTime: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        flexShrink: 0,
    },
    starBadge: {
        color: "var(--color-accent-amber)",
    },
    drawEntryBottom: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-2)",
    },
    drawTitle: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        fontWeight: 500,
        color: "var(--color-text-primary)",
    },
    drawBadges: {
        display: "flex",
        gap: "var(--space-1)",
        flexShrink: 0,
    },
    badge: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        opacity: 0.8,
    },
    drawDescription: {
        paddingTop: "var(--space-2)",
    },
    descText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
        display: "block",
    },
    descLocked: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-caption)",
        color: "var(--color-text-secondary)",
        fontStyle: "italic",
        opacity: 0.6,
        display: "block",
    },

    // ── Empty states ──────────────────────────────────────────────────────────
    emptyState: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "var(--space-5)",
    },
    emptyText: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
    },
    emptyLog: {
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-body)",
        color: "var(--color-text-secondary)",
        margin: 0,
        marginTop: "var(--space-3)",
    },
};
