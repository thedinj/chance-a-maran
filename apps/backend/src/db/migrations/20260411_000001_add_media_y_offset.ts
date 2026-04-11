import type { Database } from "better-sqlite3";

/**
 * Move image_y_offset from card_versions to media.
 *
 * The crop offset is a display property of the image asset, not card content.
 * Storing it on `media` allows it to be updated without creating a new card version:
 * only genuine content edits (title, description, levels, tags, etc.) will bump
 * the version; a crop adjustment just updates media.y_offset in place and propagates
 * to all players on the next session state poll.
 */
export function up(db: Database): void {
    db.exec(`ALTER TABLE media ADD COLUMN y_offset REAL NOT NULL DEFAULT 0.5;`);

    // Copy existing offsets from card_versions into media before dropping the column.
    // Each image may be referenced by multiple versions; use the latest per image.
    db.exec(`
        UPDATE media
        SET y_offset = (
            SELECT cv.image_y_offset
            FROM card_versions cv
            WHERE cv.image_id = media.id
            ORDER BY cv.version_number DESC
            LIMIT 1
        )
        WHERE id IN (SELECT DISTINCT image_id FROM card_versions WHERE image_id IS NOT NULL);
    `);

    db.exec(`ALTER TABLE card_versions DROP COLUMN image_y_offset;`);
}

export function down(db: Database): void {
    db.exec(`ALTER TABLE card_versions ADD COLUMN image_y_offset REAL NOT NULL DEFAULT 0.5;`);

    // Restore offsets from media back into each version that has an image
    db.exec(`
        UPDATE card_versions
        SET image_y_offset = (
            SELECT m.y_offset
            FROM media m
            WHERE m.id = card_versions.image_id
        )
        WHERE image_id IS NOT NULL;
    `);

    db.exec(`ALTER TABLE media DROP COLUMN y_offset;`);
}
