import { db } from "../db/db";
import { intToBool } from "../db/boolBridge";
import type { User } from "@chance/core";

export interface DbUser {
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    is_admin: number;
    invitation_code_id: string | null;
    last_element_selection: string | null;
    created_at: string;
}

export function mapUser(row: DbUser): User {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        isAdmin: intToBool(row.is_admin),
        createdAt: row.created_at,
    };
}

export interface AdminUser {
    id: string;
    email: string;
    displayName: string;
    isAdmin: boolean;
    cardCount: number;
    createdAt: string;
}

export function findAll(): AdminUser[] {
    const rows = db
        .prepare(
            `SELECT u.id, u.email, u.display_name, u.is_admin, u.created_at,
                    COUNT(c.id) AS card_count
             FROM users u
             LEFT JOIN cards c ON c.owner_user_id = u.id
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        )
        .all() as Array<DbUser & { card_count: number }>;

    return rows.map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        isAdmin: intToBool(r.is_admin),
        cardCount: r.card_count,
        createdAt: r.created_at,
    }));
}

export function findById(id: string): DbUser | null {
    return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as DbUser | undefined) ?? null;
}

export function findByEmail(email: string): DbUser | null {
    return (
        (db
            .prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE")
            .get(email) as DbUser | undefined) ?? null
    );
}

export function create(data: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
    invitationCodeId?: string;
}): DbUser {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO users (id, email, display_name, password_hash, is_admin, invitation_code_id, created_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(data.id, data.email, data.displayName, data.passwordHash, data.invitationCodeId ?? null, now);

    return findById(data.id)!;
}

export function update(
    id: string,
    patch: Partial<{
        displayName: string;
        email: string;
        passwordHash: string;
        isAdmin: boolean;
        lastElementSelection: string[] | null;
    }>
): DbUser {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (patch.displayName !== undefined) {
        sets.push("display_name = ?");
        params.push(patch.displayName);
    }
    if (patch.email !== undefined) {
        sets.push("email = ?");
        params.push(patch.email);
    }
    if (patch.passwordHash !== undefined) {
        sets.push("password_hash = ?");
        params.push(patch.passwordHash);
    }
    if (patch.isAdmin !== undefined) {
        sets.push("is_admin = ?");
        params.push(patch.isAdmin ? 1 : 0);
    }
    if (patch.lastElementSelection !== undefined) {
        sets.push("last_element_selection = ?");
        params.push(
            patch.lastElementSelection ? JSON.stringify(patch.lastElementSelection) : null
        );
    }

    if (sets.length === 0) return findById(id)!;

    params.push(id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return findById(id)!;
}

export function getLastElementSelection(userId: string): string[] | null {
    const row = db
        .prepare("SELECT last_element_selection FROM users WHERE id = ?")
        .get(userId) as { last_element_selection: string | null } | undefined;
    if (!row?.last_element_selection) return null;
    return JSON.parse(row.last_element_selection) as string[];
}
