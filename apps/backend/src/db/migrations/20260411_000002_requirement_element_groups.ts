import type { Database } from "better-sqlite3";
import { SYSTEM_ELEMENT_GROUPS } from "@chance/core";

export function up(db: Database): void {
    db.exec(`
        CREATE TABLE requirement_element_groups (
            id         TEXT    NOT NULL PRIMARY KEY,
            name       TEXT    NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            locked     INTEGER NOT NULL DEFAULT 0
        );

        ALTER TABLE requirement_elements
            ADD COLUMN group_id TEXT REFERENCES requirement_element_groups(id) ON DELETE SET NULL;
    `);

    const stmt = db.prepare(
        `INSERT OR IGNORE INTO requirement_element_groups (id, name, sort_order, locked) VALUES (?, ?, ?, 1)`
    );
    for (const g of SYSTEM_ELEMENT_GROUPS) {
        stmt.run(g.id, g.name, g.sortOrder);
    }
}

export function down(db: Database): void {
    db.exec(`
        ALTER TABLE requirement_elements DROP COLUMN group_id;
        DROP TABLE requirement_element_groups;
    `);
}
