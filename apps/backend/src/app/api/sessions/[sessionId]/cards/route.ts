import { AuthorizationError, SubmitCardRequestSchema, ValidationError } from "@chance/core";
import { fail, handleError, ok } from "@/lib/auth/response";
import { withAuth } from "@/lib/auth/withAuth";
import * as cardService from "@/lib/services/cardService";

export const dynamic = "force-dynamic";

/** POST /api/sessions/:sessionId/cards — submit a card within a session. Registered users only. */
export const POST = withAuth(async (req, { params }) => {
    try {
        if (req.auth.type !== "user") {
            return fail(new AuthorizationError("Only registered users can submit cards"));
        }

        const { sessionId } = await params;
        const body = await req.json();
        const parsed = SubmitCardRequestSchema.safeParse(body);
        if (!parsed.success) {
            return fail(new ValidationError("Invalid request body", parsed.error.flatten()));
        }

        const card = cardService.submitCard(req.auth.sub, sessionId, parsed.data);
        return ok(card, 201);
    } catch (err) {
        return handleError(err);
    }
});
