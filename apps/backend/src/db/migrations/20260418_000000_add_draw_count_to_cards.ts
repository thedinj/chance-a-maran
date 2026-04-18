import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`ALTER TABLE cards ADD COLUMN draw_count INTEGER NOT NULL DEFAULT 0;`);
    db.exec(
        `UPDATE cards SET draw_count = (SELECT COUNT(*) FROM draw_events WHERE draw_events.card_id = cards.id);`
    );
}

export function down(db: Database): void {
    db.exec(`ALTER TABLE cards DROP COLUMN draw_count;`);
}
