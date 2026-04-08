import { AuthorizationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/cards/:cardId/nominate — nominates card for global promotion. Owner only. */
export const POST = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can nominate cards"));
        }

        const { cardId } = await params;
        const card = cardService.nominateForGlobal(req.auth.sub, cardId);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
