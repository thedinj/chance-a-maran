import { db } from "../db/db";
import { normalizeInvitationCode } from "../utils/normalizeCode";

export interface DbInvitationCode {
    id: string;
    code: string;
    created_by_user_id: string | null;
    expires_at: string | null;
    is_active: number;
    max_uses: number | null;
    created_at: string;
}

export interface AdminInvitationCode {
    id: string;
    code: string;
    createdByEmail: string | null;
    expiresAt: string | null;
    isActive: boolean;
    useCount: number;
    maxUses: number | null;
    createdAt: string;
}

export function findAll(): AdminInvitationCode[] {
    const rows = db
        .prepare(
            `SELECT ic.id, ic.code, ic.expires_at, ic.is_active, ic.max_uses, ic.created_at,
                    creator.email AS created_by_email,
                    (SELECT COUNT(*) FROM users u WHERE u.invitation_code_id = ic.id) AS use_count
             FROM invitation_codes ic
             LEFT JOIN users creator ON ic.created_by_user_id = creator.id
             ORDER BY ic.created_at DESC`
        )
        .all() as Array<{
        id: string;
        code: string;
        expires_at: string | null;
        is_active: number;
        max_uses: number | null;
        created_at: string;
        created_by_email: string | null;
        use_count: number;
    }>;

    return rows.map((r) => ({
        id: r.id,
        code: r.code,
        createdByEmail: r.created_by_email,
        expiresAt: r.expires_at,
        isActive: r.is_active === 1,
        useCount: r.use_count,
        maxUses: r.max_uses,
        createdAt: r.created_at,
    }));
}

export function setActive(id: string, isActive: boolean): void {
    db.prepare("UPDATE invitation_codes SET is_active = ? WHERE id = ?").run(isActive ? 1 : 0, id);
}

export function findByCode(code: string): DbInvitationCode | null {
    return (
        (db
            .prepare("SELECT * FROM invitation_codes WHERE code = ?")
            .get(normalizeInvitationCode(code)) as DbInvitationCode | undefined) ?? null
    );
}

export function countUses(codeId: string): number {
    const row = db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE invitation_code_id = ?")
        .get(codeId) as { n: number };
    return row.n;
}

export function create(data: {
    id: string;
    code: string;
    createdByUserId?: string;
    expiresAt?: Date;
    maxUses?: number | null;
}): DbInvitationCode {
    const normalized = normalizeInvitationCode(data.code);
    db.prepare(`
        INSERT INTO invitation_codes (id, code, created_by_user_id, expires_at, is_active, max_uses, created_at)
        VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(
        data.id,
        normalized,
        data.createdByUserId ?? null,
        data.expiresAt?.toISOString() ?? null,
        data.maxUses ?? null,
        new Date().toISOString()
    );
    return findByCode(normalized)!;
}

export function upsertSeeded(code: string): DbInvitationCode {
    const existing = findByCode(code);
    if (existing) return existing;
    return create({ id: require("crypto").randomUUID(), code });
}
