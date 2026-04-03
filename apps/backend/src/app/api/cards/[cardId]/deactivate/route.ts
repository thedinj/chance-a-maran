import { AuthorizationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** PATCH /api/cards/:cardId/deactivate — sets active=false. Owner or admin. */
export const PATCH = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can deactivate cards"));
        }

        const { cardId } = await params;
        const isAdmin = req.auth.scopes.includes("admin");
        const card = cardService.deactivateCard(req.auth.sub, cardId, isAdmin);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
