import { db } from "../db/db";
import { intToBool } from "../db/boolBridge";
import type { Player } from "@chance/core";

export interface DbPlayer {
    id: string;
    session_id: string;
    user_id: string | null;
    display_name: string;
    player_token: string | null;
    card_sharing: "none" | "mine";
    active: number;
    joined_at: string;
}

export function mapPlayer(row: DbPlayer): Player {
    return {
        id: row.id,
        sessionId: row.session_id,
        displayName: row.display_name,
        userId: row.user_id,
        active: intToBool(row.active),
        cardSharing: row.card_sharing,
    };
}

export function create(data: {
    id: string;
    sessionId: string;
    userId?: string;
    displayName: string;
    playerToken?: string;
    cardSharing?: "none" | "mine";
}): DbPlayer {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO session_players (id, session_id, user_id, display_name, player_token, card_sharing, active, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
        data.id,
        data.sessionId,
        data.userId ?? null,
        data.displayName,
        data.playerToken ?? null,
        data.cardSharing ?? "mine",
        now
    );
    return findById(data.id)!;
}

export function findById(id: string): DbPlayer | null {
    return (
        (db
            .prepare("SELECT * FROM session_players WHERE id = ?")
            .get(id) as DbPlayer | undefined) ?? null
    );
}

export function findBySessionId(sessionId: string): DbPlayer[] {
    return db
        .prepare("SELECT * FROM session_players WHERE session_id = ? ORDER BY joined_at ASC")
        .all(sessionId) as DbPlayer[];
}

export function findBySessionAndDisplayName(
    sessionId: string,
    displayName: string
): DbPlayer | null {
    return (
        (db
            .prepare(
                "SELECT * FROM session_players WHERE session_id = ? AND lower(display_name) = lower(?)"
            )
            .get(sessionId, displayName) as DbPlayer | undefined) ?? null
    );
}

export function findBySessionAndUserId(sessionId: string, userId: string): DbPlayer | null {
    return (
        (db
            .prepare("SELECT * FROM session_players WHERE session_id = ? AND user_id = ?")
            .get(sessionId, userId) as DbPlayer | undefined) ?? null
    );
}

export function update(
    id: string,
    patch: Partial<{ active: boolean; displayName: string; cardSharing: "none" | "mine"; playerToken: string | null }>
): DbPlayer {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (patch.active !== undefined) {
        sets.push("active = ?");
        params.push(patch.active ? 1 : 0);
    }
    if (patch.displayName !== undefined) {
        sets.push("display_name = ?");
        params.push(patch.displayName);
    }
    if (patch.cardSharing !== undefined) {
        sets.push("card_sharing = ?");
        params.push(patch.cardSharing);
    }
    if (patch.playerToken !== undefined) {
        sets.push("player_token = ?");
        params.push(patch.playerToken);
    }

    if (sets.length === 0) return findById(id)!;

    params.push(id);
    db.prepare(`UPDATE session_players SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return findById(id)!;
}

export function resetToken(id: string): void {
    db.prepare("UPDATE session_players SET player_token = NULL WHERE id = ?").run(id);
}

export function setUserId(id: string, userId: string): void {
    db.prepare("UPDATE session_players SET user_id = ? WHERE id = ?").run(userId, id);
}
