import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        CREATE TABLE soundboard_sounds (
            id                  TEXT    NOT NULL PRIMARY KEY,
            name                TEXT    NOT NULL,
            emoji               TEXT    NOT NULL,
            media_id            TEXT    NOT NULL REFERENCES media(id),
            active              INTEGER NOT NULL DEFAULT 1,
            sort_order          INTEGER NOT NULL DEFAULT 0,
            created_by_user_id  TEXT    NOT NULL REFERENCES users(id),
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_soundboard_sounds_active ON soundboard_sounds(active, sort_order);
    `);
}

export function down(db: Database): void {
    db.exec(`
        DROP INDEX IF EXISTS idx_soundboard_sounds_active;
        DROP TABLE soundboard_sounds;
    `);
}
