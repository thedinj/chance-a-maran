import { z } from "zod";
import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardRepo from "@/lib/repos/cardRepo";
import * as userRepo from "@/lib/repos/userRepo";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
    cardIds: z.array(z.string()).min(1),
    targetUserId: z.string().min(1),
    fields: z.array(z.enum(["author", "owner"])).min(1),
});

/** POST /api/admin/cards/bulk-reassign — bulk reassign author/owner on a set of cards. */
export const POST = withAdmin(async (req) => {
    try {
        const body = await req.json();
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request"));
        }

        const { cardIds, targetUserId, fields } = parsed.data;

        const targetUser = userRepo.findById(targetUserId);
        if (!targetUser) {
            return fail(new ValidationError("Target user not found"));
        }

        let authorUpdated = 0;
        let ownerUpdated = 0;

        if (fields.includes("author")) {
            authorUpdated = cardRepo.bulkReassignAuthor(cardIds, targetUserId);
        }
        if (fields.includes("owner")) {
            ownerUpdated = cardRepo.bulkReassignOwner(cardIds, targetUserId);
        }

        return ok({ authorUpdated, ownerUpdated });
    } catch (err) {
        return handleError(err);
    }
});
