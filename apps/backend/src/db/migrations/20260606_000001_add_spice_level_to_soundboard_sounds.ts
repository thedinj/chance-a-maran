import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        ALTER TABLE soundboard_sounds ADD COLUMN spice_level INTEGER NOT NULL DEFAULT 1;
    `);
}

export function down(db: Database): void {
    // SQLite does not support DROP COLUMN in older versions; recreate the table without it.
    db.exec(`
        CREATE TABLE soundboard_sounds_tmp (
            id                  TEXT     NOT NULL PRIMARY KEY,
            name                TEXT     NOT NULL,
            emoji               TEXT     NOT NULL,
            media_id            TEXT     NOT NULL REFERENCES media(id),
            active              INTEGER  NOT NULL DEFAULT 1,
            sort_order          INTEGER  NOT NULL DEFAULT 0,
            created_by_user_id  TEXT     NOT NULL REFERENCES users(id),
            created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO soundboard_sounds_tmp SELECT id, name, emoji, media_id, active, sort_order, created_by_user_id, created_at FROM soundboard_sounds;
        DROP TABLE soundboard_sounds;
        ALTER TABLE soundboard_sounds_tmp RENAME TO soundboard_sounds;
        CREATE INDEX idx_soundboard_sounds_active ON soundboard_sounds(active, sort_order);
    `);
}
