import { db } from "../db/db";
import { intToBool } from "../db/boolBridge";
import type { DrawEvent } from "@chance/core";
import { findById as findCardById, findVersionById } from "./cardRepo";

// ─── DB type ──────────────────────────────────────────────────────────────────

export interface DbDrawEvent {
    id: string;
    session_id: string;
    player_id: string;
    card_version_id: string;
    drawn_at: string;
    revealed_to_all_at: string | null;
    description_shared: number;
    resolved: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCardIdForVersion(cardVersionId: string): string | null {
    const row = db
        .prepare("SELECT card_id FROM card_versions WHERE id = ?")
        .get(cardVersionId) as { card_id: string } | undefined;
    return row?.card_id ?? null;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

export function mapDrawEvent(row: DbDrawEvent): DrawEvent {
    const cardVersion = findVersionById(row.card_version_id)!;
    const cardId = getCardIdForVersion(row.card_version_id)!;
    const card = findCardById(cardId)!;
    return {
        id: row.id,
        sessionId: row.session_id,
        playerId: row.player_id,
        cardVersionId: row.card_version_id,
        cardVersion,
        card,
        drawnAt: row.drawn_at,
        revealedToAllAt: row.revealed_to_all_at,
        descriptionShared: intToBool(row.description_shared),
        resolved: intToBool(row.resolved),
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findRaw(id: string): DbDrawEvent | null {
    return (
        (db
            .prepare("SELECT * FROM draw_events WHERE id = ?")
            .get(id) as DbDrawEvent | undefined) ?? null
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function create(data: {
    id: string;
    sessionId: string;
    playerId: string;
    cardVersionId: string;
    drawnAt: string;
    revealedToAllAt: string;
}): DrawEvent {
    db.prepare(
        `INSERT INTO draw_events (id, session_id, player_id, card_version_id, drawn_at, revealed_to_all_at, description_shared, resolved)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0)`
    ).run(
        data.id,
        data.sessionId,
        data.playerId,
        data.cardVersionId,
        data.drawnAt,
        data.revealedToAllAt
    );
    return mapDrawEvent(findRaw(data.id)!);
}

export function findById(id: string): DrawEvent | null {
    const row = findRaw(id);
    if (!row) return null;
    return mapDrawEvent(row);
}

export function findBySessionId(sessionId: string): DrawEvent[] {
    const rows = db
        .prepare(
            "SELECT * FROM draw_events WHERE session_id = ? ORDER BY drawn_at DESC"
        )
        .all(sessionId) as DbDrawEvent[];
    return rows.map(mapDrawEvent);
}

export function update(
    id: string,
    patch: Partial<{
        revealedToAllAt: string;
        descriptionShared: boolean;
        resolved: boolean;
    }>
): DrawEvent {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (patch.revealedToAllAt !== undefined) {
        sets.push("revealed_to_all_at = ?");
        params.push(patch.revealedToAllAt);
    }
    if (patch.descriptionShared !== undefined) {
        sets.push("description_shared = ?");
        params.push(patch.descriptionShared ? 1 : 0);
    }
    if (patch.resolved !== undefined) {
        sets.push("resolved = ?");
        params.push(patch.resolved ? 1 : 0);
    }

    if (sets.length > 0) {
        params.push(id);
        db.prepare(`UPDATE draw_events SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    }

    return mapDrawEvent(findRaw(id)!);
}

/** Returns the set of card IDs that have been drawn in this session. Used for recency suppression. */
export function getDrawnCardIds(sessionId: string): Set<string> {
    const rows = db
        .prepare(
            `SELECT DISTINCT cv.card_id
             FROM draw_events de
             JOIN card_versions cv ON de.card_version_id = cv.id
             WHERE de.session_id = ?`
        )
        .all(sessionId) as { card_id: string }[];
    return new Set(rows.map((r) => r.card_id));
}
