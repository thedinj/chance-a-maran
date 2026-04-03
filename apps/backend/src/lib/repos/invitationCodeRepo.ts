import { db } from "../db/db";

export interface DbInvitationCode {
    id: string;
    code: string;
    created_by_user_id: string | null;
    used_by_user_id: string | null;
    expires_at: string | null;
    is_active: number;
    created_at: string;
}

export function findByCode(code: string): DbInvitationCode | null {
    return (
        (db
            .prepare("SELECT * FROM invitation_codes WHERE code = ?")
            .get(code) as DbInvitationCode | undefined) ?? null
    );
}

export function consume(id: string, usedByUserId: string): void {
    db.prepare(
        "UPDATE invitation_codes SET used_by_user_id = ? WHERE id = ? AND used_by_user_id IS NULL"
    ).run(usedByUserId, id);
}

export function create(data: {
    id: string;
    code: string;
    createdByUserId?: string;
    expiresAt?: Date;
}): DbInvitationCode {
    db.prepare(`
        INSERT INTO invitation_codes (id, code, created_by_user_id, expires_at, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
    `).run(
        data.id,
        data.code,
        data.createdByUserId ?? null,
        data.expiresAt?.toISOString() ?? null,
        new Date().toISOString()
    );
    return findByCode(data.code)!;
}

export function upsertSeeded(code: string): DbInvitationCode {
    const existing = findByCode(code);
    if (existing) return existing;
    return create({ id: require("crypto").randomUUID(), code });
}
