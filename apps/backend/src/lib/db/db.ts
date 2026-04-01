import Database from "better-sqlite3";
import * as path from "path";

const globalForDb = globalThis as unknown as {
    db: Database.Database | undefined;
};

// Database path is always database.db in the backend directory
const dbPath = path.join(process.cwd(), "database.db");

export const db =
    globalForDb.db ??
    new Database(dbPath, {
        verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
    });

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Cache the database instance in development
if (process.env.NODE_ENV !== "production") {
    globalForDb.db = db;
}

// Graceful shutdown
process.on("beforeExit", () => {
    db.close();
});
