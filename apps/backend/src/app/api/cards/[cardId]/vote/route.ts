import { AuthorizationError, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/cards/:cardId/vote — vote up or down. Any authenticated user. */
export const POST = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can vote"));
        }

        const { cardId } = await params;
        const body = await req.json();
        if (body.direction !== "up" && body.direction !== "down") {
            return fail(new ValidationError("direction must be 'up' or 'down'"));
        }

        cardService.voteCard(req.auth.sub, cardId, body.direction);
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});

/** DELETE /api/cards/:cardId/vote — clear the current user's vote. */
export const DELETE = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can vote"));
        }

        const { cardId } = await params;
        cardService.clearVote(req.auth.sub, cardId);
        return ok(undefined);
    } catch (err) {
        return handleError(err);
    }
});
