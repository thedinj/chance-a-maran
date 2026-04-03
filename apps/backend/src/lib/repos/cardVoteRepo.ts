import { db } from "../db/db";

// ─── Public API ───────────────────────────────────────────────────────────────

/** Insert or replace a vote. */
export function upsert(cardId: string, userId: string, direction: "up" | "down"): void {
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO card_votes (id, card_id, user_id, direction, created_at)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)
         ON CONFLICT(card_id, user_id) DO UPDATE SET direction = excluded.direction`
    ).run(cardId, userId, direction, now);
}

/** Remove the current user's vote. No-op if none exists. */
export function remove(cardId: string, userId: string): void {
    db.prepare("DELETE FROM card_votes WHERE card_id = ? AND user_id = ?").run(cardId, userId);
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
