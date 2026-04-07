import { db } from "../db/db";
import type { FilterSettings, Session } from "@chance/core";
import { normalizeJoinCode } from "../utils/stringUtils";

export interface DbSession {
    id: string;
    host_player_id: string | null;
    name: string;
    join_code: string;
    qr_token: string;
    filter_settings: string;
    status: "active" | "ended" | "expired";
    created_at: string;
    ended_at: string | null;
}

export function mapSession(row: DbSession): Session {
    return {
        id: row.id,
        hostPlayerId: row.host_player_id ?? "",
        name: row.name,
        joinCode: row.join_code,
        filterSettings: JSON.parse(row.filter_settings) as FilterSettings,
        status: row.status,
        createdAt: row.created_at,
        endedAt: row.ended_at ?? null,
    };
}

export function create(data: {
    id: string;
    name: string;
    joinCode: string;
    qrToken: string;
    filterSettings: FilterSettings;
}): DbSession {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO sessions (id, host_player_id, name, join_code, qr_token, filter_settings, status, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, 'active', ?)
    `).run(
        data.id,
        data.name,
        normalizeJoinCode(data.joinCode),
        data.qrToken,
        JSON.stringify(data.filterSettings),
        now
    );
    return findById(data.id)!;
}

export function findById(id: string): DbSession | null {
    return (
        (db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as DbSession | undefined) ?? null
    );
}

export function findByJoinCode(code: string): DbSession | null {
    return (
        (db
            .prepare("SELECT * FROM sessions WHERE join_code = ?")
            .get(code) as DbSession | undefined) ?? null
    );
}

export function setHostPlayer(id: string, hostPlayerId: string): void {
    db.prepare("UPDATE sessions SET host_player_id = ? WHERE id = ?").run(hostPlayerId, id);
}

export function updateStatus(id: string, status: "active" | "ended" | "expired"): void {
    db.prepare("UPDATE sessions SET status = ? WHERE id = ?").run(status, id);
}

export function updateSettings(
    id: string,
    settings: { name?: string; filterSettings: FilterSettings }
): DbSession {
    db.prepare(
        "UPDATE sessions SET name = COALESCE(?, name), filter_settings = ? WHERE id = ?"
    ).run(settings.name ?? null, JSON.stringify(settings.filterSettings), id);
    return findById(id)!;
}

export function setEndedAt(id: string, endedAt: string): void {
    db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(endedAt, id);
}

export interface DbSessionSummary extends DbSession {
    player_count: number;
    draw_count: number;
}

export function findHistoryByUserId(userId: string): DbSessionSummary[] {
    return db
        .prepare(
            `SELECT s.*,
                    COUNT(DISTINCT sp.id) AS player_count,
                    COUNT(DISTINCT de.id) AS draw_count
             FROM sessions s
             JOIN session_players sp ON sp.session_id = s.id
             LEFT JOIN draw_events de ON de.session_id = s.id
             WHERE sp.user_id = ?
               AND s.status IN ('ended', 'expired')
             GROUP BY s.id
             ORDER BY s.created_at DESC`
        )
        .all(userId) as DbSessionSummary[];
}

export function findActiveByUserId(userId: string): DbSessionSummary[] {
    return db
        .prepare(
            `SELECT s.*,
                    COUNT(DISTINCT sp.id) AS player_count,
                    COUNT(DISTINCT de.id) AS draw_count
             FROM sessions s
             JOIN session_players sp ON sp.session_id = s.id
             LEFT JOIN draw_events de ON de.session_id = s.id
             WHERE sp.user_id = ?
               AND s.status = 'active'
             GROUP BY s.id
             ORDER BY s.created_at DESC`
        )
        .all(userId) as DbSessionSummary[];
}
