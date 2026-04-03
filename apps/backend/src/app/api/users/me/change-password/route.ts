import { AuthenticationError, AuthorizationError, NotFoundError } from "@chance/core";
import type { ChangePasswordRequest } from "@chance/core";
import { compare, hash } from "bcryptjs";
import { handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as userRepo from "@/lib/repos/userRepo";

export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 12;

/** POST /api/users/me/change-password — change the current user's password. */
export const POST = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            throw new AuthorizationError("Registered account required");
        }

        const body = (await req.json()) as Partial<ChangePasswordRequest>;
        if (!body.currentPassword || !body.newPassword) {
            throw new AuthorizationError("currentPassword and newPassword are required");
        }

        const user = userRepo.findById(req.auth.sub);
        if (!user) throw new NotFoundError("User not found");

        const valid = await compare(body.currentPassword, user.password_hash);
        if (!valid) throw new AuthenticationError("Current password is incorrect");

        const passwordHash = await hash(body.newPassword, BCRYPT_ROUNDS);
        userRepo.update(req.auth.sub, { passwordHash });
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
