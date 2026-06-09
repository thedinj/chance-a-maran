import type { Database } from "better-sqlite3";

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000001";

export function up(db: Database): void {
    db.prepare(
        `INSERT INTO users (id, email, display_name, password_hash, is_admin, created_at)
         VALUES (?, 'system@chance.internal', 'System', ?, 0, CURRENT_TIMESTAMP)`
    ).run(SYSTEM_USER_ID, "$2a$12$m3K1F1KKtxxR35KLuLIKqOASq7z2nnq47K983NdRwplRnE010iQkG");
}

export function down(db: Database): void {
    db.prepare(`DELETE FROM users WHERE id = ?`).run(SYSTEM_USER_ID);
}
