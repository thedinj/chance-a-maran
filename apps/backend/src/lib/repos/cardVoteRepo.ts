import { db } from "../db/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recompute and store net_votes on the cards row. */
function refreshNetVotes(cardId: string): void {
    db.prepare(
        `UPDATE cards SET net_votes = COALESCE(
            (SELECT SUM(CASE WHEN direction = 'up' THEN 1 ELSE -1 END)
             FROM card_votes WHERE card_id = ?),
            0
         ) WHERE id = ?`
    ).run(cardId, cardId);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Insert or replace a vote, then refresh the denormalized net_votes. */
export function upsert(cardId: string, userId: string, direction: "up" | "down"): void {
    const now = new Date().toISOString();
    db.transaction(() => {
        db.prepare(
            `INSERT INTO card_votes (id, card_id, user_id, direction, created_at)
             VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
             ON CONFLICT(card_id, user_id) DO UPDATE SET direction = excluded.direction`
        ).run(cardId, userId, direction, now);
        refreshNetVotes(cardId);
    })();
}

/** Remove the current user's vote, then refresh the denormalized net_votes. */
export function remove(cardId: string, userId: string): void {
    db.transaction(() => {
        db.prepare("DELETE FROM card_votes WHERE card_id = ? AND user_id = ?").run(cardId, userId);
        refreshNetVotes(cardId);
    })();
}

/** Returns the net vote score (upvotes minus downvotes). */
export function getNetScore(cardId: string): number {
    const row = db
        .prepare(
            `SELECT COALESCE(SUM(CASE WHEN direction = 'up' THEN 1 ELSE -1 END), 0) AS net
             FROM card_votes WHERE card_id = ?`
        )
        .get(cardId) as { net: number };
    return row.net;
}
