import { AuthorizationError, NotFoundError, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import * as userRepo from "@/lib/repos/userRepo";

export const dynamic = "force-dynamic";

/** POST /api/admin/users/:userId/reset-password
 *  Body: { adminPassword: string, newPassword: string }
 *  Verifies the calling admin's own password before resetting the target user's password.
 */
export const POST = withAdmin(async (req, { params }) => {
    try {
        const { userId } = await params;
        const target = userRepo.findById(userId);
        if (!target) return fail(new NotFoundError("User not found"));

        const body = await req.json();
        const { adminPassword, newPassword } = body as {
            adminPassword?: string;
            newPassword?: string;
        };

        if (!adminPassword || !newPassword) {
            return fail(new ValidationError("adminPassword and newPassword are required"));
        }
        if (newPassword.length < 8) {
            return fail(new ValidationError("New password must be at least 8 characters"));
        }

        // Verify the admin's own password
        const adminUser = userRepo.findById(req.auth.sub)!;
        const valid = await verifyPassword(adminPassword, adminUser.password_hash);
        if (!valid) return fail(new AuthorizationError("Incorrect admin password"));

        const passwordHash = await hashPassword(newPassword);
        userRepo.update(userId, { passwordHash });

        return ok({});
    } catch (err) {
        return handleError(err);
    }
});
