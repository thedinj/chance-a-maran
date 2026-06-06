You are creating a new backend API route for the Chance app. Before writing any code, read the most similar existing route in `apps/backend/src/app/api/` to internalize the exact pattern.

## What to build

The user's message (or `$ARGUMENTS`) describes the new endpoint. Determine:
- **HTTP method** (GET / POST / PATCH / DELETE)
- **Path** (e.g. `/api/widgets`, `/api/sessions/:id/recap`)
- **Auth level**: `withAuth` (any JWT) or `withAdmin` (admin scope)
- **Registered-user check**: does it need `req.auth.type !== "user"` guard?
- **Input source**: URL params, query params, or JSON body
- **Schema**: which Zod schema from `@chance/core` to use (or create one)
- **Service**: which service function to call (or create one)

---

## File to create

`apps/backend/src/app/api/<path>/route.ts`

For dynamic segments, use Next.js bracket syntax: `[sessionId]`, `[cardId]`, etc.

---

## Exact route template

```ts
import { SomeRequestSchema, AuthorizationError, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth"; // or withAdmin
import * as someService from "@/lib/services/someService";

export const dynamic = "force-dynamic";

/** POST /api/widgets — registered users only. */
export const POST = withAuth(async (req) => {
    try {
        // Registered-user guard (omit for guest-accessible endpoints)
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can do this"));
        }

        // Parse body
        const body = await req.json();
        const parsed = SomeRequestSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        // Call service
        const result = someService.doThing(req.auth.sub, parsed.data);
        return ok(result, 201); // 201 for creates, 200 for updates/deletes
    } catch (err) {
        return handleError(err);
    }
});
```

**For GET with query params:**
```ts
export const GET = withAuth(async (req) => {
    try {
        const { searchParams } = new URL(req.url);
        const filter = searchParams.get("filter") ?? undefined;

        const items = someRepo.findAll({ filter });
        return ok(items);
    } catch (err) {
        return handleError(err);
    }
});
```

**For dynamic segments** (`[widgetId]/route.ts`):
```ts
export const PATCH = withAuth(async (req, { params }) => {
    try {
        const { widgetId } = params as { widgetId: string };
        // ...
    } catch (err) {
        return handleError(err);
    }
});
```

---

## Rules (never violate)

- `export const dynamic = "force-dynamic"` — always, at the top of every route file.
- All responses use `ok()`, `fail()`, `handleError()` — never `new Response(...)` directly.
- Mutations return the **full updated entity** so clients can reconcile in one round-trip.
- Zod validation: always `safeParse()` → check `.success` → `fail(new ValidationError(...))` if not.
- Auth checks: `withAdmin` wraps `withAuth`; use `withAdmin` for `/api/admin/*` routes.
- Throw `AppError` subclasses (`NotFoundError`, `AuthorizationError`, `ConflictError`, etc.) from services — `handleError` converts them automatically.
- POST → 201, PATCH/DELETE → 200.
- No string interpolation in SQL — all DB access via prepared statements in repos.

---

## After creating the route

If you created a new Zod schema or type, also:
1. Export it from `packages/core/src/schemas/index.ts`
2. Add the API method to `apps/mobile/src/lib/api/real.ts` (and stub to `mock.ts`)
3. Re-export from `apps/mobile/src/lib/api/types.ts` if the type is needed on the client

---

## Auth wrapper quick reference

| Wrapper | Who can call |
|---|---|
| `withAuth` | Any valid JWT (registered user OR guest) |
| `withAdmin` | Registered user with `is_admin = true` only |
| `withAuth` + `req.auth.type !== "user"` check | Registered users only (no guests) |

**Guest-accessible routes** (withAuth, no type check): draw, vote, session state, player actions.
**Registered-only routes**: submit card, create session, account management.
**Admin-only routes**: `/api/admin/*` — always use `withAdmin`.
