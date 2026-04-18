import { db } from "../db/db";
import { intToBool } from "../db/boolBridge";
import type { DrawEvent } from "@chance/core";
import { findById as findCardById, findVersionById } from "./cardRepo";

// ─── DB type ──────────────────────────────────────────────────────────────────

export interface DbDrawEvent {
    id: string;
    session_id: string;
    player_id: string;
    card_id: string;
    card_version_id: string;
    drawn_at: string;
    revealed_to_all_at: string | null;
    description_shared: number;
    resolved: number;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

export function mapDrawEvent(row: DbDrawEvent): DrawEvent {
    const cardVersion = findVersionById(row.card_version_id)!;
    const card = findCardById(row.card_id)!;
    return {
        id: row.id,
        sessionId: row.session_id,
        playerId: row.player_id,
        cardVersionId: row.card_version_id,
        cardVersion,
        card,
        drawnAt: row.drawn_at,
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
    cardId: string;
    cardVersionId: string;
    drawnAt: string;
    revealedToAllAt: string;
}): DrawEvent {
    db.prepare(
        `INSERT INTO draw_events (id, session_id, player_id, card_id, card_version_id, drawn_at, revealed_to_all_at, description_shared, resolved)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`
    ).run(
        data.id,
        data.sessionId,
        data.playerId,
        data.cardId,
        data.cardVersionId,
        data.drawnAt,
        data.revealedToAllAt
    );
    db.prepare("UPDATE cards SET draw_count = draw_count + 1 WHERE id = ?").run(data.cardId);
    return mapDrawEvent(findRaw(data.id)!);
}

export function findById(id: string): DrawEvent | null {
    const row = findRaw(id);
    if (!row) return null;
    return mapDrawEvent(row);
}

/** Returns only events that should be visible to the requesting player:
 *  - their own events always, and
 *  - everyone else's events once `revealed_to_all_at` has passed on the server clock.
 */
export function findRevealedBySessionId(
    sessionId: string,
    requestingPlayerId: string | null
): DrawEvent[] {
    const now = new Date().toISOString();
    const rows = (
        requestingPlayerId
            ? db
                  .prepare(
                      `SELECT * FROM draw_events
                       WHERE session_id = ?
                         AND (player_id = ? OR (revealed_to_all_at IS NOT NULL AND revealed_to_all_at <= ?))
                       ORDER BY drawn_at ASC`
                  )
                  .all(sessionId, requestingPlayerId, now)
            : db
                  .prepare(
                      `SELECT * FROM draw_events
                       WHERE session_id = ?
                         AND revealed_to_all_at IS NOT NULL AND revealed_to_all_at <= ?
                       ORDER BY drawn_at ASC`
                  )
                  .all(sessionId, now)
    ) as DbDrawEvent[];
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
        .prepare("SELECT DISTINCT card_id FROM draw_events WHERE session_id = ?")
        .all(sessionId) as { card_id: string }[];
    return new Set(rows.map((r) => r.card_id));
}

/** Deletes all draw events for a session, resetting the drawn-card history. */
export function clearDrawEvents(sessionId: string): void {
    db.prepare("DELETE FROM draw_events WHERE session_id = ?").run(sessionId);
}
