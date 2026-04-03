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
    patch: Partial<{ displayName: string; email: string; passwordHash: string; isAdmin: boolean }>
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

    if (sets.length === 0) return findById(id)!;

    params.push(id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return findById(id)!;
}
