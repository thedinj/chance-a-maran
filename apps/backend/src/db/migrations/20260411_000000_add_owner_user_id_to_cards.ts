import type { Database } from "better-sqlite3";

/**
 * Split cards.author_user_id into two separate columns:
 *   - author_user_id: immutable original creator, set at card creation and never changed.
 *   - owner_user_id:  current owner, starts equal to author, mutable via ownership transfer.
 *
 * Previously author_user_id was overloaded as both "original author" and "current owner",
 * making it impossible to transfer a card without losing the original authorship attribution.
 */
export function up(db: Database): void {
    // Add the new column (nullable so backfill can run without a dummy default)
    db.exec(`ALTER TABLE cards ADD COLUMN owner_user_id TEXT REFERENCES users(id);`);

    // Backfill: every card's owner starts as its author
    db.exec(`UPDATE cards SET owner_user_id = author_user_id;`);

    // Index for ownership queries (draw pool inclusion, "my cards" lookup, transfer checks)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cards_owner_user_id ON cards(owner_user_id);`);
}

export function down(db: Database): void {
    db.exec(`DROP INDEX IF EXISTS idx_cards_owner_user_id;`);
    db.exec(`ALTER TABLE cards DROP COLUMN owner_user_id;`);
}
