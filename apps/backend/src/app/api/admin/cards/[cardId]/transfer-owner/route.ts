import { ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAdmin } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/admin/cards/:cardId/transfer-owner — reassign card.owner_user_id to a different registered user. */
export const POST = withAdmin(async (req, { params }) => {
    try {
        const { cardId } = await params;
        const body = await req.json();
        const { newOwnerUserId } = body as { newOwnerUserId?: string };

        if (!newOwnerUserId || typeof newOwnerUserId !== "string") {
            return fail(new ValidationError("newOwnerUserId is required"));
        }

        const updated = await cardService.transferOwnership(cardId, newOwnerUserId);
        return ok(updated);
    } catch (err) {
        return handleError(err);
    }
});
