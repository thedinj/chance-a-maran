import { config } from "dotenv";
import { resolve } from "path";
import { readdirSync, readFileSync } from "fs";
import { initializeDatabase } from "../src/db/init";
import { db } from "../src/lib/db/db";

config({ path: resolve(__dirname, "../.env") });

const MIGRATIONS_DIR = resolve(__dirname, "../src/db/migrations");

function ensureMigrationsTable() {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT (datetime('now'))
        )
    `).run();
}

function getApplied(): Set<string> {
    const rows = db.prepare("SELECT filename FROM schema_migrations").all() as { filename: string }[];
    return new Set(rows.map((r) => r.filename));
}

function applyMigration(filename: string, sql: string) {
    db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(filename);
    })();
    console.log(`  ✓ ${filename}`);
}

function main() {
    console.log("Initializing database...");
    initializeDatabase();
    ensureMigrationsTable();

    let files: string[];
    try {
        files = readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith(".sql"))
            .sort();
    } catch {
        // No migrations directory yet — nothing to apply
        files = [];
    }

    const applied = getApplied();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
        console.log("No pending migrations.");
    } else {
        console.log(`Applying ${pending.length} migration(s)...`);
        for (const filename of pending) {
            const sql = readFileSync(resolve(MIGRATIONS_DIR, filename), "utf-8");
            applyMigration(filename, sql);
        }
    }

    console.log("Done.");
}

main();
db.close();
