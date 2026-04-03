import { AuthorizationError, SubmitCardRequestSchema, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** PATCH /api/cards/:cardId — create a new version of a card. Owner or admin. */
export const PATCH = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can edit cards"));
        }

        const { cardId } = await params;
        const body = await req.json();
        const parsed = SubmitCardRequestSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        const isAdmin = req.auth.scopes.includes("admin");
        const card = cardService.updateCard(req.auth.sub, cardId, parsed.data, isAdmin);
        return ok(card);
    } catch (err) {
        return handleError(err);
    }
});
