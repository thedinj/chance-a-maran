import { NotFoundError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as userRepo from "@/lib/repos/userRepo";

export const dynamic = "force-dynamic";

export const PATCH = withAdmin(async (req, { params }) => {
    try {
        const { userId } = await params;
        const existing = userRepo.findById(userId);
        if (!existing) return fail(new NotFoundError("User not found"));

        const body = await req.json();
        const { isAdmin, displayName, email } = body as {
            isAdmin?: boolean;
            displayName?: string;
            email?: string;
        };

        userRepo.update(userId, {
            ...(isAdmin !== undefined && { isAdmin }),
            ...(displayName !== undefined && { displayName: displayName.trim() }),
            ...(email !== undefined && { email: email.trim().toLowerCase() }),
        });

        const updated = userRepo.findAll().find((u) => u.id === userId)!;
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
});
