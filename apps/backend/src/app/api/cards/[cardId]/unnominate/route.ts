import { AuthorizationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/cards/:cardId/unnominate — withdraws/rejects a global nomination. Owner or admin. */
export const POST = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can withdraw nominations"));
        }

        const { cardId } = await params;
        const isAdmin = req.auth.scopes.includes("admin");
        const card = cardService.withdrawNomination(req.auth.sub, cardId, isAdmin);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
