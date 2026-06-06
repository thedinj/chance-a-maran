You are scaffolding a new full-stack feature for the Chance app. Work through every layer in order — do not skip any. Before writing code for each layer, read the most similar existing file at that layer to match the exact pattern.

## What to build

The user's message (or `$ARGUMENTS`) describes the feature. Extract:
- **Feature name** (e.g. "rewards", "player achievements")
- **Entity name** (PascalCase singular, e.g. `Reward`) and table name (snake_case plural, e.g. `rewards`)
- **Operations**: which of create / read / update / delete / list are needed
- **Access level**: who can do each operation (guest / registered / admin)
- **Mobile UI**: does this need a new screen, a modal on an existing screen, or just API wiring?

---

## Layer 1 — Core schema (`packages/core/src/schemas/`)

Create `packages/core/src/schemas/<entity>.ts`:

```ts
import { z } from "zod";

export const EntitySchema = z.object({
    id: z.string(),
    // ... all fields
    createdAt: z.string(),
});

export type Entity = z.infer<typeof EntitySchema>;

// Request schemas (stricter — required fields, limits)
export const CreateEntityRequestSchema = z.object({
    name: z.string().min(1).max(100),
    // ...
});
export type CreateEntityRequest = z.infer<typeof CreateEntityRequestSchema>;

export const UpdateEntityRequestSchema = CreateEntityRequestSchema.partial();
export type UpdateEntityRequest = z.infer<typeof UpdateEntityRequestSchema>;
```

Then export from `packages/core/src/schemas/index.ts`:
```ts
export * from "./<entity>";
```

**Rules**: schemas live only in `packages/core` — never duplicate types in the apps. Use `z.infer<>` for all TypeScript types. Text field limits → add constants to `packages/core/src/constants/textLimits.ts` if they'll be reused.

---

## Layer 2 — Migration (`apps/backend/src/db/migrations/`)

Create `<YYYYMMDD_HHMMSS>_create_<entity_plural>.ts` (use `/new-migration` for the full pattern):

```ts
import type { Database } from "better-sqlite3";

export function up(db: Database): void {
    db.exec(`
        CREATE TABLE <entity_plural> (
            id          TEXT    NOT NULL PRIMARY KEY,
            name        TEXT    NOT NULL,
            active      INTEGER NOT NULL DEFAULT 1,
            user_id     TEXT    NOT NULL REFERENCES users(id),
            created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

export function down(db: Database): void {
    db.exec(`DROP TABLE <entity_plural>;`);
}
```

Also update `apps/backend/src/db/init.ts` with the same DDL so fresh databases are consistent.

---

## Layer 3 — Repo (`apps/backend/src/lib/repos/<entity>Repo.ts`)

```ts
import { db } from "../db/db";
import { intToBool, boolToInt } from "../db/boolBridge";
import type { Entity } from "@chance/core";

export interface DbEntity {
    id: string;
    name: string;
    active: number;
    user_id: string;
    created_at: string;
}

export function mapEntity(row: DbEntity): Entity {
    return {
        id: row.id,
        name: row.name,
        active: intToBool(row.active),
        userId: row.user_id,
        createdAt: row.created_at,
    };
}

export function findById(id: string): Entity | null {
    const row = db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as DbEntity | undefined;
    return row ? mapEntity(row) : null;
}

export function findByUser(userId: string): Entity[] {
    return (db.prepare("SELECT * FROM entities WHERE user_id = ? ORDER BY created_at DESC").all(userId) as DbEntity[]).map(mapEntity);
}

export function create(data: { id: string; name: string; userId: string }): Entity {
    db.prepare(`
        INSERT INTO entities (id, name, active, user_id)
        VALUES (?, ?, 1, ?)
    `).run(data.id, data.name, data.userId);
    return findById(data.id)!;
}

export function update(id: string, patch: { name?: string; active?: boolean }): Entity {
    if (patch.name !== undefined) {
        db.prepare("UPDATE entities SET name = ? WHERE id = ?").run(patch.name, id);
    }
    if (patch.active !== undefined) {
        db.prepare("UPDATE entities SET active = ? WHERE id = ?").run(boolToInt(patch.active), id);
    }
    return findById(id)!;
}
```

**Rules**: always use prepared statements — no string interpolation. Booleans stored as INTEGER via `boolToInt`/`intToBool`. Return typed domain objects, not raw DB rows.

---

## Layer 4 — Service (`apps/backend/src/lib/services/<entity>Service.ts`)

```ts
import { randomUUID } from "crypto";
import { AuthorizationError, NotFoundError } from "@chance/core";
import type { CreateEntityRequest, UpdateEntityRequest, Entity } from "@chance/core";
import * as entityRepo from "../repos/entityRepo";

export function create(userId: string, req: CreateEntityRequest): Entity {
    return entityRepo.create({ id: randomUUID(), name: req.name, userId });
}

export function getByUser(userId: string): Entity[] {
    return entityRepo.findByUser(userId);
}

export function update(userId: string, entityId: string, req: UpdateEntityRequest): Entity {
    const entity = entityRepo.findById(entityId);
    if (!entity) throw new NotFoundError("Entity not found");
    if (entity.userId !== userId) throw new AuthorizationError("Not your entity");
    return entityRepo.update(entityId, req);
}

export function remove(userId: string, entityId: string): void {
    const entity = entityRepo.findById(entityId);
    if (!entity) throw new NotFoundError("Entity not found");
    if (entity.userId !== userId) throw new AuthorizationError("Not your entity");
    entityRepo.remove(entityId);
}
```

**Rules**: throw `AppError` subclasses (`NotFoundError`, `AuthorizationError`, `ConflictError`, `ValidationError`, `InternalError`). Never access DB directly — call repos. Business rules and ownership checks live here.

---

## Layer 5 — API routes (`apps/backend/src/app/api/`)

Use `/new-api-route` for each endpoint. Quick summary:

```ts
// apps/backend/src/app/api/entities/route.ts
export const dynamic = "force-dynamic";

export const GET = withAuth(async (req) => { /* ... */ });
export const POST = withAuth(async (req) => { /* ... */ });

// apps/backend/src/app/api/entities/[entityId]/route.ts
export const PATCH = withAuth(async (req, { params }) => { /* ... */ });
export const DELETE = withAuth(async (req, { params }) => { /* ... */ });
```

---

## Layer 6 — Mobile API client

**Add to `apps/mobile/src/lib/api/real.ts`**:
```ts
async getEntities(): Promise<ApiResult<Entity[]>> {
    return this.get("/api/entities");
}

async createEntity(req: CreateEntityRequest): Promise<ApiResult<Entity>> {
    return this.post("/api/entities", req);
}
```

**Add stub to `apps/mobile/src/lib/api/mock.ts`** (return sensible fake data).

**Re-export type** from `apps/mobile/src/lib/api/types.ts` if needed on the client:
```ts
export type { Entity, CreateEntityRequest } from "@chance/core";
```

---

## Layer 7 — Mobile UI

Determine what's needed:
- **New screen**: use `/new-screen` — creates `apps/mobile/src/pages/<PageName>.tsx` + registers route in `App.tsx`
- **Modal on existing screen**: add an `IonModal` with `IonContent`/`IonFooter` inside the existing page
- **No UI yet**: skip Layer 7 and note that it's needed

**UX rules for any new UI element:**
- Back navigation: `«` (guillemet) button, `color: var(--color-accent-primary)`, min 44×44 px
- Page title: in content area (`<h1>` inside `pageHeader` div), not in `<IonToolbar>`
- Mutations: `startTransition(async () => {...})` + `isPending` drives `<LoadingOverlay>`; forms stay rendered
- Errors: inline `<p style={{ color: "var(--color-danger)" }}>`, never a toast for expected errors
- Primary CTA: `<IonButton>` in `<IonFooter>` for form pages; inline for action pages
- All lists: flex column with `borderBottom: "1px solid var(--color-border)"` rows
- CSS vars only — never hardcoded hex values

---

## Checklist before finishing

- [ ] Schema exported from `packages/core/src/schemas/index.ts`
- [ ] Migration file created with correct timestamp, `up` + `down`
- [ ] `init.ts` updated with same DDL
- [ ] Repo has `DbEntity` interface + `mapEntity` + all needed queries
- [ ] Service enforces ownership + throws typed errors
- [ ] Routes have `export const dynamic = "force-dynamic"`, correct auth wrapper, Zod parse
- [ ] Mobile API client methods added to `real.ts` + stub in `mock.ts`
- [ ] UI created (or explicitly deferred with a note)
- [ ] Run `pnpm --filter backend db:migrate` to verify migration executes cleanly
- [ ] Run `pnpm lint && pnpm typecheck` to verify no type errors
