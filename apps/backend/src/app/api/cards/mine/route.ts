import { AuthorizationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardRepo from "@/lib/repos/cardRepo";

export const dynamic = "force-dynamic";

/** GET /api/cards/mine — returns all cards authored by the authenticated user. */
export const GET = withAuth(async (req) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users have a card library"));
        }

        const cards = cardRepo.findByAuthorUserId(req.auth.sub);
        return ok(cards);
    } catch (err) {
        return handleError(err);
    }
});
