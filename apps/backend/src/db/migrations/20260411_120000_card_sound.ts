import type { Database } from "better-sqlite3";

/**
 * Add sound_id to card_versions so each version can optionally specify
 * a custom MP3 to play instead of the default cymbal hit sound at card reveal.
 */
export function up(db: Database): void {
    db.exec(`ALTER TABLE card_versions ADD COLUMN sound_id TEXT REFERENCES media(id);`);
}

export function down(db: Database): void {
    db.exec(`ALTER TABLE card_versions DROP COLUMN sound_id;`);
}
