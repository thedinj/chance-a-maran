import { db } from "../db/db";
import type { FilterSettings, Session } from "@chance/core";

export interface DbSession {
    id: string;
    host_player_id: string | null;
    name: string;
    join_code: string;
    qr_token: string;
    filter_settings: string;
    status: "active" | "ended" | "expired";
    created_at: string;
    expires_at: string | null;
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
        expiresAt: row.expires_at ?? "",
    };
}

export function create(data: {
    id: string;
    name: string;
    joinCode: string;
    qrToken: string;
    filterSettings: FilterSettings;
    expiresAt?: Date;
}): DbSession {
    const now = new Date().toISOString();
    const defaultExpiry = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000);
    const expiresAt = (data.expiresAt ?? defaultExpiry).toISOString();
    db.prepare(`
        INSERT INTO sessions (id, host_player_id, name, join_code, qr_token, filter_settings, status, created_at, expires_at)
        VALUES (?, NULL, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
        data.id,
        data.name,
        data.joinCode,
        data.qrToken,
        JSON.stringify(data.filterSettings),
        now,
        expiresAt
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

export function updateFilters(id: string, filterSettings: FilterSettings): DbSession {
    db.prepare("UPDATE sessions SET filter_settings = ? WHERE id = ?").run(
        JSON.stringify(filterSettings),
        id
    );
    return findById(id)!;
}
