import { AuthorizationError, ConflictError, NotFoundError } from "@chance/core";
import type { UpdateUserRequest } from "@chance/core";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as userRepo from "@/lib/repos/userRepo";

export const dynamic = "force-dynamic";

/** GET /api/users/me — return current user profile + last element selection. */
export const GET = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            throw new AuthorizationError("Registered account required");
        }
        const user = userRepo.findById(req.auth.sub);
        if (!user) throw new NotFoundError("User not found");
        return ok({
            ...userRepo.mapUser(user),
            lastElementSelection: userRepo.getLastElementSelection(req.auth.sub),
        });
    } catch (err) {
        return handleError(err);
    }
});

/** PATCH /api/users/me — update current user's display name and/or email. */
export const PATCH = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            throw new AuthorizationError("Registered account required");
        }

        const body = (await req.json()) as Partial<UpdateUserRequest>;

        if (body.email !== undefined) {
            const existing = userRepo.findByEmail(body.email);
            if (existing && existing.id !== req.auth.sub) {
                throw new ConflictError("An account with this email already exists");
            }
        }

        const updated = userRepo.update(req.auth.sub, {
            ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
            ...(body.email !== undefined ? { email: body.email } : {}),
        });
        return ok(userRepo.mapUser(updated));
    } catch (err) {
        return handleError(err);
    }
});
