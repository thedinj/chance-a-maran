import type { Database } from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { db } from "../lib/db/db";

interface Migration {
    filename: string;
    up: (db: Database) => void;
    down: (db: Database) => void;
}

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

/**
 * Get all migration files sorted by timestamp
 */
function getMigrationFiles(): string[] {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return [];
    }

    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
        .sort(); // Timestamp prefix ensures correct ordering
}

/**
 * Create migrations tracking table if it doesn't exist
 */
function initMigrationsTable(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "_migrations" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "filename" TEXT NOT NULL UNIQUE,
            "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

/**
 * Get list of already applied migrations
 */
function getAppliedMigrations(): string[] {
    const rows = db.prepare(`SELECT filename FROM "_migrations" ORDER BY id ASC`).all() as {
        filename: string;
    }[];

    return rows.map((row) => row.filename);
}

/**
 * Record a migration as applied
 */
function recordMigration(filename: string): void {
    db.prepare(`INSERT INTO "_migrations" (filename) VALUES (?)`).run(filename);
}

/**
 * Remove a migration record (for rollback)
 */
function unrecordMigration(filename: string): void {
    db.prepare(`DELETE FROM "_migrations" WHERE filename = ?`).run(filename);
}

/**
 * Load and execute pending migrations
 */
export async function runMigrations(): Promise<void> {
    console.log("Running database migrations...");

    initMigrationsTable();

    const allMigrations = getMigrationFiles();
    const appliedMigrations = getAppliedMigrations();
    const pendingMigrations = allMigrations.filter((file) => !appliedMigrations.includes(file));

    if (pendingMigrations.length === 0) {
        console.log("✓ No pending migrations");
        return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const filename of pendingMigrations) {
        console.log(`  Applying: ${filename}...`);

        const migrationPath = path.join(MIGRATIONS_DIR, filename);
        const migration = require(migrationPath) as Migration;

        if (!migration.up) {
            throw new Error(`Migration ${filename} does not export an 'up' function`);
        }

        try {
            // Temporarily disable foreign keys for schema migrations that recreate tables
            // This is safe because the transaction will roll back on any error
            db.pragma("foreign_keys = OFF");

            // Run migration in a transaction
            db.transaction(() => {
                migration.up(db);
                recordMigration(filename);
            })();

            // Re-enable foreign keys
            db.pragma("foreign_keys = ON");

            console.log(`  ✓ Applied: ${filename}`);
        } catch (error) {
            console.error(`  ✗ Failed to apply migration ${filename}:`, error);
            throw error;
        }
    }

    console.log("✓ All migrations completed successfully");
}

/**
 * Rollback the last migration (development only)
 */
export async function rollbackLastMigration(): Promise<void> {
    console.log("Rolling back last migration...");

    initMigrationsTable();

    const appliedMigrations = getAppliedMigrations();

    if (appliedMigrations.length === 0) {
        console.log("No migrations to rollback");
        return;
    }

    const lastMigration = appliedMigrations[appliedMigrations.length - 1];
    console.log(`  Rolling back: ${lastMigration}...`);

    const migrationPath = path.join(MIGRATIONS_DIR, lastMigration);
    const migration = require(migrationPath) as Migration;

    if (!migration.down) {
        throw new Error(`Migration ${lastMigration} does not export a 'down' function`);
    }

    try {
        db.transaction(() => {
            migration.down(db);
            unrecordMigration(lastMigration);
        })();

        console.log(`  ✓ Rolled back: ${lastMigration}`);
    } catch (error) {
        console.error(`  ✗ Failed to rollback migration ${lastMigration}:`, error);
        throw error;
    }
}

// CLI execution
if (require.main === module) {
    const command = process.argv[2];

    if (command === "rollback") {
        rollbackLastMigration().catch((error) => {
            console.error("Migration rollback failed:", error);
            process.exit(1);
        });
    } else {
        runMigrations().catch((error) => {
            console.error("Migration failed:", error);
            process.exit(1);
        });
    }
}
