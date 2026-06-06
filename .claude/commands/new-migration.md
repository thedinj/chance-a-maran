You are creating a database migration for the Chance app. The database is **live in production** — migrations are the only safe way to change the schema. Never modify `apps/backend/src/db/init.ts` alone for production changes.

## What to build

The user's message (or `$ARGUMENTS`) describes the schema change. Determine:
- **Change type**: new table / add column / add index / rename / drop
- **SQLite constraints**: remember SQLite has limited `ALTER TABLE` support (no DROP COLUMN in old versions, no RENAME COLUMN, no ADD CONSTRAINT after creation)
- **Rollback strategy**: can `down()` simply DROP TABLE / DROP INDEX, or does it need a recreate-and-copy pattern?

---

## File to create

`apps/backend/src/db/migrations/<YYYYMMDD_HHMMSS>_<snake_case_description>.ts`

**Timestamp format**: use today's date + `000000` as the time component (e.g. `20260615_000000`). If multiple migrations are being created in one session, increment the time component (`000001`, `000002`, …) to maintain ordering.

---

## Exact migration template

```ts
import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        -- your DDL here
    `);
}

export function down(db: Database): void {
    db.exec(`
        -- reverse the DDL here
    `);
}
```

The migration runner (`apps/backend/src/db/migrate.ts`) handles the `_migrations` tracking table, disables foreign keys inside the transaction, and calls `up`/`down`. You do not need to manage any of this inside the migration file itself.

---

## SQLite column type conventions

| Data | SQLite type |
|---|---|
| UUIDs, strings, timestamps | `TEXT` |
| Booleans | `INTEGER` (0 = false, 1 = true) — use `DEFAULT 0` or `DEFAULT 1` |
| Integers | `INTEGER` |
| Floats | `REAL` |
| JSON blobs | `TEXT` (serialized) |
| Timestamps with default | `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` |

---

## Common patterns

**New table:**
```ts
export function up(db: Database): void {
    db.exec(`
        CREATE TABLE widgets (
            id          TEXT    NOT NULL PRIMARY KEY,
            name        TEXT    NOT NULL,
            active      INTEGER NOT NULL DEFAULT 1,
            user_id     TEXT    NOT NULL REFERENCES users(id),
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_widgets_user ON widgets(user_id, active);
    `);
}

export function down(db: Database): void {
    db.exec(`
        DROP INDEX IF EXISTS idx_widgets_user;
        DROP TABLE widgets;
    `);
}
```

**Add column (nullable or with default — safe):**
```ts
export function up(db: Database): void {
    db.exec(`
        ALTER TABLE widgets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    `);
}

export function down(db: Database): void {
    // SQLite cannot DROP COLUMN in older versions — recreate:
    db.exec(`
        CREATE TABLE widgets_tmp AS SELECT id, name, active, user_id, created_at FROM widgets;
        DROP TABLE widgets;
        ALTER TABLE widgets_tmp RENAME TO widgets;
    `);
    // Re-add indexes and constraints if the table had any
}
```

**Add column (NOT NULL, no default — requires backfill):**
```ts
export function up(db: Database): void {
    db.exec(`
        ALTER TABLE widgets ADD COLUMN category TEXT;
        UPDATE widgets SET category = 'default';
        -- SQLite cannot re-add NOT NULL after the fact, so enforce via app logic
        -- or recreate the table with the constraint
    `);
}
```

---

## After creating the migration file

1. **Update `apps/backend/src/db/init.ts`** — add the new DDL so fresh databases created from scratch have the same schema. This file is only used for brand-new databases; the migration runner handles existing ones.

2. **Update the repo** — if you added a column, update the `Db*` interface and `map*()` function in the corresponding `apps/backend/src/lib/repos/<entity>Repo.ts`.

3. **Update the core schema** — if the new column is user-visible, update the Zod schema in `packages/core/src/schemas/` and its `z.infer<>` type.

4. **Run the migration** to verify it executes cleanly:
   ```bash
   pnpm --filter backend db:migrate
   ```

5. To test rollback:
   ```bash
   pnpm --filter backend db:migrate rollback
   pnpm --filter backend db:migrate   # re-apply
   ```
