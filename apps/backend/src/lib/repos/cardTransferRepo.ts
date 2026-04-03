import { db } from "../db/db";
import type { CardTransfer } from "@chance/core";

// ─── DB type ──────────────────────────────────────────────────────────────────

export interface DbCardTransfer {
    id: string;
    draw_event_id: string;
    from_player_id: string;
    to_player_id: string;
    created_at: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

export function mapCardTransfer(row: DbCardTransfer): CardTransfer {
    return {
        id: row.id,
        drawEventId: row.draw_event_id,
        fromPlayerId: row.from_player_id,
        toPlayerId: row.to_player_id,
        createdAt: row.created_at,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findRaw(id: string): DbCardTransfer | null {
    return (
        (db
            .prepare("SELECT * FROM card_transfers WHERE id = ?")
            .get(id) as DbCardTransfer | undefined) ?? null
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function create(data: {
    id: string;
    drawEventId: string;
    fromPlayerId: string;
    toPlayerId: string;
}): CardTransfer {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO card_transfers (id, draw_event_id, from_player_id, to_player_id, created_at)
         VALUES (?, ?, ?, ?, ?)`
    ).run(data.id, data.drawEventId, data.fromPlayerId, data.toPlayerId, now);
    return mapCardTransfer(findRaw(data.id)!);
}

export function findById(id: string): CardTransfer | null {
    const row = findRaw(id);
    if (!row) return null;
    return mapCardTransfer(row);
}

export function findRawById(id: string): DbCardTransfer | null {
    return findRaw(id);
}

export function findBySessionId(sessionId: string): CardTransfer[] {
    const rows = db
        .prepare(
            `SELECT ct.* FROM card_transfers ct
             JOIN draw_events de ON ct.draw_event_id = de.id
             WHERE de.session_id = ?
             ORDER BY ct.created_at DESC`
        )
        .all(sessionId) as DbCardTransfer[];
    return rows.map(mapCardTransfer);
}

export function findByDrawEventId(drawEventId: string): CardTransfer | null {
    const row =
        (db
            .prepare("SELECT * FROM card_transfers WHERE draw_event_id = ?")
            .get(drawEventId) as DbCardTransfer | undefined) ?? null;
    return row ? mapCardTransfer(row) : null;
}

export function remove(id: string): void {
    db.prepare("DELETE FROM card_transfers WHERE id = ?").run(id);
}
