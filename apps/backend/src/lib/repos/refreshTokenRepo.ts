import { db } from "../db/db";

export interface DbRefreshToken {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
    revoked: number;
    created_at: string;
}

export function create(data: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
}): void {
    db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
    `).run(data.id, data.userId, data.tokenHash, data.expiresAt.toISOString(), new Date().toISOString());
}

export function findByHash(hash: string): DbRefreshToken | null {
    return (
        (db
            .prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?")
            .get(hash) as DbRefreshToken | undefined) ?? null
    );
}

export function revokeByHash(hash: string): void {
    db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?").run(hash);
}

export function revokeAllForUser(userId: string): void {
    db.prepare("UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?").run(userId);
}

export function deleteExpired(): void {
    db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?").run(new Date().toISOString());
}
