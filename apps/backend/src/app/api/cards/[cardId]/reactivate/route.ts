import { AuthorizationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** PATCH /api/cards/:cardId/reactivate — sets active=true. Owner or admin. */
export const PATCH = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can reactivate cards"));
        }

        const { cardId } = await params;
        const isAdmin = req.auth.scopes.includes("admin");
        const card = cardService.reactivateCard(req.auth.sub, cardId, isAdmin);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
